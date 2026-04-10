const WINDOW_SECONDS = 3;

class SampleBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.windowSize = Math.floor(sampleRate * WINDOW_SECONDS);
    this.buffer = new Float32Array(this.windowSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex += 1;

      if (this.bufferIndex >= this.windowSize) {
        this.port.postMessage({ samples: this.buffer.slice(0) });
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('sample-buffer', SampleBufferProcessor);
