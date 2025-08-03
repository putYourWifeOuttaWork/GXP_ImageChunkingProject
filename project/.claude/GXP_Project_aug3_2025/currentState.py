import json
import os
from paho.mqtt.client import Client

BROKER      = "fd75926705c74b15bff1179d4750c436.s1.eu.hivemq.cloud"
PORT        = 8883
USERNAME    = "gasy25"
PASSWORD    = "GasMoldBeGone12"
INFO_TOPIC  = "esp32cam/image/info"
CHUNK_TOPIC = "esp32cam/image/chunk"
OUTPUT_FILE = "reassembled.jpg"

# State
expected_chunks = None
received_data = {}

def on_connect(client, userdata, flags, rc):
    print("Connected (rc=%d), subscribing…" % rc)
    client.subscribe([(INFO_TOPIC, 0), (CHUNK_TOPIC, 0)])

def on_message(client, userdata, msg):
    global expected_chunks, received_data

    # 1) Metadata message
    if msg.topic == INFO_TOPIC:
        info = json.loads(msg.payload.decode())
        expected_chunks = info.get("total_chunks")
        received_data.clear()
        print(f"Expecting {expected_chunks} chunks.")

    # 2) End-marker (zero-length payload)
    elif msg.topic == CHUNK_TOPIC and len(msg.payload) == 0:
        if expected_chunks is None:
            print(" No metadata received; cannot reassemble.")
        else:
            print("Reassembling image…")
            missing = []
            with open(OUTPUT_FILE, "wb") as f:
                for i in range(expected_chunks):
                    chunk = received_data.get(i)
                    if chunk is None:
                        print(f" Missing chunk {i}!")
                        missing.append(i)
                        continue
                    f.write(chunk)
            if missing:
                print(f"Reassembly complete, but missing chunks: {missing}")
            else:
                print(f"Image successfully written to {OUTPUT_FILE}")
        client.disconnect()

    # 3) Normal chunk
    elif msg.topic == CHUNK_TOPIC:
        # First two bytes are chunk number (big-endian)
        chunk_num = (msg.payload[0] << 8) | msg.payload[1]
        data = msg.payload[2:]
        if chunk_num in received_data:
            print(f"Duplicate chunk {chunk_num}, skipping.")
        else:
            received_data[chunk_num] = data
            print(f"Stored chunk {chunk_num} ({len(data)} bytes).")

# Set up and run MQTT client
client = Client()
client.tls_set(cert_reqs=False)
client.tls_insecure_set(True)
client.username_pw_set(USERNAME, PASSWORD)
client.on_connect = on_connect
client.on_message = on_message

print("Connecting to broker…")
client.connect(BROKER, PORT)
client.loop_forever()