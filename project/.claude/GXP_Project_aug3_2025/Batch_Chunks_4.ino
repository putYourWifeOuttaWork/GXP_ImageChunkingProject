// ===================== ESP32-CAM Batch Chunked Uploader (128 bytes/chunk, batch of 5, retry+diagnostics) =====================
#include "WiFi.h"
#include "WiFiClientSecure.h"
#include "PubSubClient.h"
#include "SD_MMC.h"
//#define CAMERA_TASK_STACK_SIZE 16384
#include "esp_camera.h"
#include "esp_sleep.h"  // For deep sleep functionality

// --- USER CONFIGURATION -----------------------------------
static const char* ssid        = "ESPtest";
static const char* password    = "ESP32cameras";
static const char* mqtt_broker = "fd75926705c74b15bff1179d4750c436.s1.eu.hivemq.cloud";
static const uint16_t mqtt_port = 8883;
static const char* mqtt_user   = "gasy25";
static const char* mqtt_pass   = "GasMoldBeGone12";
static const char* mqtt_topic  = "esp32cam/image/chunk";
static const char* info_topic  = "esp32cam/image/info";

// --- GLOBAL BUFFERS & CONSTANTS ---------------------------
#define CHUNK_SIZE 128
#define BATCH_SIZE 15    // Number of chunks per send batch
#define MAX_RETRY 3     // Max retries for failed publish

static uint8_t chunkBuf[CHUNK_SIZE];
static uint8_t sendBuf[CHUNK_SIZE + 2];
static const char* imagePath = "/image.jpg";

// --- CAMERA PINS (AI-Thinker module) ----------------------
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Global camera configuration (fields follow declaration order)
static camera_config_t cameraConfig = {
  .pin_pwdn       = PWDN_GPIO_NUM,
  .pin_reset      = RESET_GPIO_NUM,
  .pin_xclk       = XCLK_GPIO_NUM,
  .pin_sccb_sda   = SIOD_GPIO_NUM,
  .pin_sccb_scl   = SIOC_GPIO_NUM,

  .pin_d7         = Y9_GPIO_NUM,
  .pin_d6         = Y8_GPIO_NUM,
  .pin_d5         = Y7_GPIO_NUM,
  .pin_d4         = Y6_GPIO_NUM,
  .pin_d3         = Y5_GPIO_NUM,
  .pin_d2         = Y4_GPIO_NUM,
  .pin_d1         = Y3_GPIO_NUM,
  .pin_d0         = Y2_GPIO_NUM,

  .pin_vsync      = VSYNC_GPIO_NUM,
  .pin_href       = HREF_GPIO_NUM,
  .pin_pclk       = PCLK_GPIO_NUM,

  .xclk_freq_hz   = 20000000,
  .ledc_timer     = LEDC_TIMER_0,
  .ledc_channel   = LEDC_CHANNEL_0,

  .pixel_format   = PIXFORMAT_JPEG,
  .frame_size     = FRAMESIZE_UXGA, //SVGA=800X600 ; UXGA=1600X1200
  .jpeg_quality   = 12,
  .fb_count       = 1
};

WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

// Ensure system time is set for TLS (force NTP sync)
void ensureTimeIsSet() {
  Serial.println("Resyncing NTP for TLS handshake...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now;
  for (int i = 0; i < 10; ++i) {
    now = time(nullptr);
    if (now > 1600000000) break; // synced
    Serial.print('.');
    delay(500);
  }
  Serial.println(" NTP sync done.");
}

// Connect to Wi-Fi network
void connectWiFi() {
  Serial.print("Connecting to WiFi '"); Serial.print(ssid); Serial.println("'...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.print("\nWiFi connected: ");
  Serial.println(WiFi.localIP());
}

// Connect to MQTT broker over TLS
void connectMQTT() {
  secureClient.setInsecure();
  mqtt.setServer(mqtt_broker, mqtt_port);
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT... ");
    if (mqtt.connect("esp32cam-client", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      delay(2000);
      break;
    }
    Serial.printf("failed (code %d), retrying...\n", mqtt.state());
    delay(3000);
  }
}

// Split the saved JPEG into 128-byte chunks on SD
void splitImageToChunks(int &totalChunks) {
  File img = SD_MMC.open(imagePath, FILE_READ);
  if (!img) {
    Serial.println("Failed to open image!");
    totalChunks = 0;
    return;
  }
  totalChunks = 0;
  while (img.available()) {
    size_t n = img.read(chunkBuf, CHUNK_SIZE);
    char chunkName[32];
    sprintf(chunkName, "/chunk%04d.bin", totalChunks);
    File chunkFile = SD_MMC.open(chunkName, FILE_WRITE);
    chunkFile.write(chunkBuf, n);
    chunkFile.close();
    totalChunks++;
  }
  img.close();
}

void setup() {
  Serial.begin(115200);
  // Check if waking from deep sleep timer
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("I am awake");
    // Idle; do nothing further
    while (true) {
      delay(1000);
    }
  }
  delay(100);
  if (esp_camera_init(&cameraConfig) != ESP_OK) {
    Serial.println("Camera init failed");
    while (true) delay(1000);
  }
  if (!SD_MMC.begin()) {
    Serial.println("SD init failed");
    while (true) delay(1000);
  }
}

void loop() {
  // 1. Capture frame and save to SD
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Capture failed");
    return;
  }
  File imgFile = SD_MMC.open(imagePath, FILE_WRITE);
  imgFile.write(fb->buf, fb->len);
  imgFile.close();
  Serial.println("Image saved to SD card");
  esp_camera_fb_return(fb);
  // Deinitialize camera to free camera_task stack
  esp_camera_deinit();
  Serial.println("Camera deinitialized to free stack.");

  // 2. Split image into chunks
  int totalChunks = 0;
  splitImageToChunks(totalChunks);
  Serial.printf("Split into %d chunks\n", totalChunks);

  // 3. Connect network and MQTT
  connectWiFi();
  ensureTimeIsSet();
  connectMQTT();

  // 4. Publish metadata
  char meta[64];
  int mlen = sprintf(meta, "{\"total_chunks\":%d}", totalChunks);
  mqtt.publish(info_topic, (const uint8_t*)meta, mlen, false);
  delay(500);

  // 5. Send chunks in batches
  for (int i = 0; i < totalChunks; i += BATCH_SIZE) {
    int batchEnd = (i + BATCH_SIZE < totalChunks) ? (i + BATCH_SIZE) : totalChunks;
    for (int j = i; j < batchEnd; ++j) {
      char chunkName[32];
      sprintf(chunkName, "/chunk%04d.bin", j);
      File cf = SD_MMC.open(chunkName, FILE_READ);
      if (!cf) {
        Serial.printf("Failed to open chunk %d\n", j);
        continue;
      }
      size_t n = cf.read(chunkBuf, CHUNK_SIZE);
      sendBuf[0] = (j >> 8) & 0xFF;
      sendBuf[1] = j & 0xFF;
      memcpy(sendBuf + 2, chunkBuf, n);
      size_t sendLen = n + 2;

      bool sent = false;
      int attempt = 0;
      while (!sent && attempt < MAX_RETRY) {
        if (!mqtt.connected()) {
          Serial.println("MQTT disconnected, reconnecting...");
          ensureTimeIsSet();
          connectMQTT();
        }
        sent = mqtt.publish(mqtt_topic, sendBuf, sendLen, false);
        Serial.printf("Sent chunk %d (%u bytes) attempt %d\n", j, n, attempt+1);
        if (!sent) {
          Serial.printf("Publish failed, state %d\n", mqtt.state());
          delay(2000);
          attempt++;
        }
      }
      cf.close();
      SD_MMC.remove(chunkName);
      delay(1200);
      mqtt.loop();
    }
    mqtt.disconnect();
    Serial.println("Batch sent, MQTT disconnected");
    // Reconnect only if more batches remain
    if (i + BATCH_SIZE < totalChunks) {
      ensureTimeIsSet();
      connectMQTT();
    }
  }

  // 6. Publish end marker
  if (!mqtt.connected()) {
    ensureTimeIsSet();
    connectMQTT();
  }
  mqtt.publish(mqtt_topic, (const uint8_t*)nullptr, 0);
  delay(500);

  // 7. Enter deep sleep
  Serial.println("Upload complete, entering deep sleep for 30 seconds...");
  esp_sleep_enable_timer_wakeup(30 * 1000000ULL);
  esp_deep_sleep_start();
}
