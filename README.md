# Smart Streetlight IoT Telemetry & Control Dashboard
**Course**: 25EE256 - Sensor and Instrumentation  
**Hardware & Platform**: Wokwi Simulation (ESP32 / Arduino Uno) + ThingSpeak IoT Cloud + Modern Web UI

---

## 🌟 Dashboard Features

1. **Digital Twin Visualizer**:
   - Dynamic 3D/SVG Streetlight with realistic daylight & night star sky transitions.
   - Live light cone projection:
     - **Daytime**: `OFF (0% PWM, 0W)`
     - **Night Standby**: `DIM (20% PWM, ~20W, Amber Soft Glow)`
     - **Night Motion Active**: `ACTIVE (100% PWM, 100W, Bright Xenon Beam + Pedestrian Indicator)`
   - Live telemetry HUD overlay.

2. **Real-Time Sensor Gauges**:
   - **LDR Ambient Light**: Radial gauge with percentage, raw ADC (0-1023), estimated Lux, and threshold marker (< 500).
   - **PIR Motion Radar**: Circular sweep radar screen with pulsing target blips and trigger counter.
   - **Energy Analytics**: Live power draw bar (0-100W), kWh saved, and CO2 emissions avoided vs. conventional always-on streetlights.

3. **Live Historical Multi-Charts (Chart.js)**:
   - Line chart for Ambient Light Intensity over time with dynamic threshold line.
   - Stepped/line chart for Streetlight Brightness (PWM) and Motion events over time.

4. **ThingSpeak Cloud Integration**:
   - Auto-polls feeds every 15 seconds (aligned with ThingSpeak free tier limit).
   - Live feed log table with status chips.
   - One-click CSV dataset export.
   - In-app Configuration Modal to connect any ThingSpeak Channel ID & Read Key.
   - Built-in **Interactive Simulation Mode** to test sensor behaviors immediately.

---

## 📡 ThingSpeak Channel Field Mapping

Create a new channel on [ThingSpeak](https://thingspeak.com/) with the following fields:

| Field | Description | Type / Values |
|---|---|---|
| **Field 1** | LDR Ambient Light Sensor | Integer (0 - 1023 ADC) |
| **Field 2** | PIR Motion Detection | Binary (0 = Clear, 1 = Detected) |
| **Field 3** | Streetlight LED Brightness | Integer PWM (0, 50, 255) |
| **Field 4** | Power Consumption Estimate | Float (0.0 W, 20.0 W, 100.0 W) |
| **Field 5** | Operating Mode Index | Integer (0 = Day, 1 = Standby, 2 = Active) |

---

## 🚀 Getting Started

### 1. Launch the Frontend Dashboard
Simply open [index.html](file:///c:/Projects_Sanjay/SI%20PROJECT/index.html) in any modern web browser (or serve with `npx serve` / Live Server).

- Click **"Configure API"** at the top right to enter your **ThingSpeak Channel ID** and **Read API Key**.
- Or click **"Simulation: OFF"** to toggle the interactive slider mode and simulate LDR/PIR sensor values in real-time.

### 2. Connect Wokwi Simulation to ThingSpeak
Because standard Arduino Uno boards in Wokwi do not have a built-in virtual WiFi stack, we provide the **ESP32** version in `wokwi_esp32/` which connects seamlessly to `Wokwi-GUEST` WiFi:

1. Open Wokwi or create a new ESP32 project.
2. Copy the code from [wokwi_esp32/sketch.ino](file:///c:/Projects_Sanjay/SI%20PROJECT/wokwi_esp32/sketch.ino).
3. Copy the wiring layout from [wokwi_esp32/diagram.json](file:///c:/Projects_Sanjay/SI%20PROJECT/wokwi_esp32/diagram.json).
4. Replace `YOUR_THINGSPEAK_WRITE_API_KEY` in line 16 of `sketch.ino` with your channel's **Write API Key**.
5. Start the Wokwi simulation! Sensor telemetry will start streaming every 15 seconds to ThingSpeak and appear on your dashboard.
