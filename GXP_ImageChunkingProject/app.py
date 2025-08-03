import os, json, base64
from io import BytesIO
from datetime import datetime
from collections import defaultdict

import paho.mqtt.client as mqtt
from supabase import create_client, Client

# --- ENV VARS ---
MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASS = os.getenv("MQTT_PASS")
INFO_TOPIC = os.getenv("INFO_TOPIC", "esp32cam/image/info")
CHUNK_TOPIC = os.getenv("CHUNK_TOPIC", "esp32cam/image/chunk")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "petri-images")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- MEMORY BUFFERS ---
expected_chunks = None
received_data = {}
image_id = None

def upload_image_and_insert():
    global image_id, received_data

    # Reassemble
    image_bytes = BytesIO()
    for i in range(expected_chunks):
        if i not in received_data:
            print(f"Missing chunk {i}")
            return
        image_bytes.write(received_data[i])
    print(f"[+] All {expected_chunks} chunks stitched")

    # Upload to Supabase
    filename = f"{image_id}.jpg"
    image_bytes.seek(0)
    supabase.storage.from_(SUPABASE_BUCKET).upload(filename, image_bytes, {"content-type": "image/jpeg"})

    # Image URL
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"

    # Insert metadata
    result = supabase.table("gxp_raw_observations").insert({
        "gxp_id": "dev-default",
        "image_id": image_id,
        "image_url": public_url,
        "chunk_status": "complete",
        "submitted_at": datetime.utcnow().isoformat(),
        "raw_payload": {}  # Expand later
    }).execute()
    print("[✔] Uploaded and inserted record:", result)

def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT broker")
    client.subscribe([(INFO_TOPIC, 0), (CHUNK_TOPIC, 0)])

def on_message(client, userdata, msg):
    global expected_chunks, received_data, image_id

    if msg.topic == INFO_TOPIC:
        meta = json.loads(msg.payload.decode())
        expected_chunks = meta["total_chunks"]
        image_id = meta.get("image_id", f"img-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
        received_data.clear()
        print(f"Expecting {expected_chunks} chunks for {image_id}")

    elif msg.topic == CHUNK_TOPIC and len(msg.payload) == 0:
        if expected_chunks is None:
            print("⚠ No metadata received before end marker")
            return
        print("End marker received, stitching image")
        upload_image_and_insert()
        expected_chunks = None
        received_data.clear()

    elif msg.topic == CHUNK_TOPIC:
        chunk_num = (msg.payload[0] << 8) | msg.payload[1]
        data = msg.payload[2:]
        if chunk_num in received_data:
            print(f"Duplicate chunk {chunk_num}, skipping.")
        else:
            received_data[chunk_num] = data
            print(f"Chunk {chunk_num} received ({len(data)} bytes)")

client = mqtt.Client()
client.tls_set(cert_reqs=None)
client.tls_insecure_set(True)
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_BROKER, MQTT_PORT, 60)
print("[MQTT] Connecting...")
client.loop_forever()
