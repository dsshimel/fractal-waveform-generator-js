// Constants
const AUDIO_BIT_RATE = 16; // 16 bit audio
const AUDIO_BYTE_RATE = AUDIO_BIT_RATE / 8;
const NUM_CHANNELS = 1
const SAMPLE_RATE = 44100
const WAV_HEADER_LENGTH = 44;
const WAVEFORM_LENGTH = 44100 // 1 second of audio

// 1. Generate the fractal data, i.e. X and Y arrays.
function Point(x, y) {
  // [0.0, 1.0]
  this.x = x;

  // [-0.5, 0.5]
  this.y = y;
}

function Segment(start, end) {
  // Point
  this.start = start;

  // Point
  this.end = end;
}

function LinearFractal(points) {
  // Array<Point>
  // Must have at least two points
  this.points = points;

  this.X = function() {
    return this.points.map(p => p.x);
  }

  this.Y = function() {
    return this.points.map(p => p.y);
  }

  this.getSegments = function() {
    const segments = [];
    for (let i = 1; i < this.points.length; i++) {
      segments.push(
        new Segment(
          this.points[i - 1],
          this.points[i]))
    }
    return segments;
  }

  this.copyPoints = function() {
    const pointsCopy = [];
    for (let point of this.points) {
      pointsCopy.push(new Point(point.x, point.y));
    }
    return pointsCopy;
  }
}

const iterateFractal = function(fractal, generator) {
  const nextFractalLayerPoints = [];
  for (let fractalSegment of fractal.getSegments()) {
    const nextFractalSegmentPoints = generator.copyPoints();

    const deltaXFractal = fractalSegment.end.x - fractalSegment.start.x;
    const xDisplacementFractal = fractalSegment.start.x
    // Ranges between [-1.0, 1.0] because the max point Y value is 0.5 in either direction.
    const deltaYFractal = fractalSegment.end.y - fractalSegment.start.y
    const yDisplacementFractal = (fractalSegment.end.y + fractalSegment.start.y) / 2

    // If the segment is infinitely narrow, so we can't fractallize it.
    if (deltaXFractal <= 0) {
      // There was also no change in y, so skip it.
      if (deltaYFractal <= 0) {
        continue;
      }

      // We'll add a straight vertical line (jumps are allowed).
      nextFractalLayerPoints.push(new Point(fractalSegment.start.x, fractalSegment.start.y));
      nextFractalLayerPoints.push(new Point(fractalSegment.end.x, fractalSegment.end.y));
      continue;
    }

    for (let point of nextFractalSegmentPoints) {
      point.x = (deltaXFractal * point.x) + xDisplacementFractal
      point.y = (deltaYFractal * point.y) + yDisplacementFractal
    }

    nextFractalLayerPoints.push(...nextFractalSegmentPoints)
  }

  return new LinearFractal(nextFractalLayerPoints);
}

const createRandomPoints = function(numPoints) {
  const x = [0.0];
  for (let i = 0; i < numPoints - 2; i++) {
    x.push(Math.random())
  }
  x.sort();
  x.push(1.0);

  const y = [];
  let maxY = -0.5;
  let minY = 0.5;
  for (let i = 0; i < numPoints; i++) {
    // [-0.5, 0.5]
    const nextY = Math.random() - 0.5;
    if (nextY > maxY) maxY = nextY;
    if (nextY < minY) minY = nextY;
    y.push(nextY);
  }
  // Not sure if I really need to normalize the y values
  // if (normalizeY) {
  //   const yRange = maxY - minY;
  //   const maxHeadroom = 0.5 - maxY;
  //   const minHeadroom = -0.5 - minY;
  //   const yAverage = (maxY + minY) / 2;
  //   if (yRange > 0) {
  //     for (let i = 0; i < numPoints; i++) {
  //       if (y[i] < yAverage) {
  //         y[i] -= minHeadroom; 
  //       } else {
  //         y[i] += maxHeadroom;
  //       }
  //       // y[i] = ((y[i] + 0.5) / yRange) - 0.5;
  //     }
  //   }
  // }

  const result = [];
  for (let i = 0; i < numPoints; i++) {
    result.push(new Point(x[i], y[i]));
  }
  console.log(result);
  return result;
}

const createWavBlobFromAudioBuffer = function(audioBuffer) {
  const wavLength = WAV_HEADER_LENGTH + audioBuffer.length * AUDIO_BYTE_RATE * NUM_CHANNELS; // bytes
  const wavBuffer = new ArrayBuffer(wavLength);
  const wavDataView = new DataView(wavBuffer);
  wavDataView.setUint32(0, 0x46464952, true); // "RIFF"
  wavDataView.setUint32(4, wavLength - 8, true);
  wavDataView.setUint32(8, 0x45564157, true); // "WAVE"
  wavDataView.setUint32(12, 0x20746d66, true); // "fmt"
  wavDataView.setUint32(16, 16, true); // length of format data
  wavDataView.setUint16(20, 1, true); // format type 1, PCM uncompressed
  wavDataView.setUint16(22, NUM_CHANNELS, true);
  wavDataView.setUint32(24, SAMPLE_RATE, true);
  wavDataView.setUint32(28, SAMPLE_RATE * AUDIO_BYTE_RATE * NUM_CHANNELS, true);
  wavDataView.setUint16(32, AUDIO_BYTE_RATE * NUM_CHANNELS, true);
  wavDataView.setUint16(34, AUDIO_BIT_RATE, true);
  wavDataView.setUint32(36, 0x61746164, true); // "data"
  wavDataView.setUint32(40, wavLength - 44, true); // length of the data in bytes

  var waveBytePosition = 44;
  for (var i = 0; i < audioBuffer.length; i++) {
    var value = audioBuffer[i]; // 32 bit float
    if (value < 0) {
      value = Math.floor(value * 32767);
    } else {
      value = Math.floor(value * 32768);
    }
    wavDataView.setInt16(waveBytePosition, value, true);
    waveBytePosition += 2;
  }

  console.log("first audio value: " + audioBuffer[0]);

  return new Blob([wavBuffer], {type: 'audio/wave'});
}

const renderFractalAudioBufferToCanvas = function(audioBuffer, generationNumber) {
  const canvas = document.getElementById('canvas' + generationNumber);
  canvas.setAttribute('width', Math.floor(window.innerWidth * 0.9));
  canvas.setAttribute('height', Math.floor(window.innerHeight * 0.9));
  const canvasWidth = canvas.getAttribute('width');
  const height = canvas.getAttribute('height');
  console.log(canvasWidth + "x" + height);
  const ctx = canvas.getContext('2d');

  const xStepSize = canvasWidth / WAVEFORM_LENGTH;
  const firstDrawingYValue = height - (height * ((1.0 + audioBuffer[0]) / 2));
  ctx.moveTo(0, firstDrawingYValue);
  console.log("start drawing at 0, " + firstDrawingYValue)

  for (var i = 10; i < WAVEFORM_LENGTH; i += 10) {
    const x = xStepSize * i;
    const y = height - (height * ((1.0 + audioBuffer[i]) / 2));
    if (i == 10) {
      console.log("first line drawn to " + x + ", " + y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

// "Main" program starts here
const numGeneratorPoints = 3 + Math.floor(Math.random() * 5);
const numInitiatorPoints = 2 + Math.floor(Math.random() * 4);
const generator = new LinearFractal(createRandomPoints(numGeneratorPoints));
const initiatorPoints = createRandomPoints(numInitiatorPoints);
const initiator = new LinearFractal(initiatorPoints);
// const generator = new LinearFractal([
//   new Point(0.0, -0.5),
//   new Point(0.25, 0.0),
//   new Point(0.75, 0.25),
//   new Point(1.0, 0.5),
// ]);
// const initiator = new LinearFractal([
//   new Point(0.0, 0.0),
//   new Point(0.25, 0.5),
//   new Point(0.75, -0.5),
//   new Point(1.0, 0.0),
// ]);

// Generate the fractal sequence.
const numGenerations = 5;
let currentFractal = initiator;
fractalGenerations = [];
for (let i = 0; i < numGenerations; i++) {
  currentFractal = iterateFractal(currentFractal, generator);
  fractalGenerations.push(currentFractal);

  // if (i % 2 == 0) {
  //   resultFractal = iterateFractal(resultFractal, generator);
  // } else {
  //   resultFractal = iterateFractal(generator, resultFractal);
  // }

  // if (Math.random() < 0.5) {
  //   resultFractal = iterateFractal(resultFractal, generator);
  // } else {
  //   resultFractal = iterateFractal(generator, resultFractal);
  // }
}

const convertFractalToAudioBuffer = function(X, Y) {
  const audioContext = new AudioContext();
  console.log("Number of fractal points: " + X.length);

  // Create an empty audio buffer within the context that has the 
  // desired properties.
  /* AudioBuffer */ const fractalWaveformBuffer = audioContext.createBuffer(/*numOfChannels*/ 1, WAVEFORM_LENGTH, SAMPLE_RATE);

  /* Float32Array */ const audioBuffer = fractalWaveformBuffer.getChannelData(0);
  var currentMaxFractalXIndex = 1;
  for (var i = 0; i < WAVEFORM_LENGTH; i++) {
    var sampleXPoint = i / WAVEFORM_LENGTH;
    while (X[currentMaxFractalXIndex] < sampleXPoint) {
      currentMaxFractalXIndex++;
    }

    var fractalXLeft = X[currentMaxFractalXIndex - 1];
    var fractalXRight = X[currentMaxFractalXIndex];
    var fractalYLeft = Y[currentMaxFractalXIndex - 1];
    var fractalYRight = Y[currentMaxFractalXIndex];
    var fractalDeltaX = fractalXRight - fractalXLeft;

    if (fractalDeltaX == 0) {
      var sampleYPoint = fractalYLeft + fractalYRight;
      audioBuffer[i] = sampleYPoint;
    } else {
      // If the sample point is closer to one side, we subtract the distance to the _other_ side to get the interpolation fraction
      // fraction because distance is inversely proportional.
      var interpolationFractionLeft = fractalXRight - sampleXPoint;
      var sampleYLeft = 2 * fractalYLeft * ((interpolationFractionLeft) / fractalDeltaX);
      if (isNaN(sampleYLeft)) {
        sampleYLeft = 0;
      }
      var interpolationFractionRight = sampleXPoint - fractalXLeft;
      var sampleYRight = 2 * fractalYRight * ((interpolationFractionRight) / fractalDeltaX);
      if (isNaN(sampleYRight)) {
        sampleYRight = 0;
      }

      var sampleYPoint = sampleYLeft + sampleYRight;
      audioBuffer[i] = sampleYPoint;
    }
  }

  return audioBuffer;
}

// Convert each generation to WAV and graph them.
for (let generationNumber = 0; generationNumber < fractalGenerations.length; generationNumber++) {
  const resultFractal = fractalGenerations[generationNumber];
  const X = resultFractal.X();
  const Y = resultFractal.Y();

  // 2. Convert the data into an AudioBuffer.
  const audioBuffer = convertFractalToAudioBuffer(X, Y);

  // 3. Convert the AudioBuffer into a WAV file.
  const wavBlob = createWavBlobFromAudioBuffer(audioBuffer);

  const wavBlobUrl = URL.createObjectURL(wavBlob);
  const downloadLinkElement = document.getElementById('downloadLink' + generationNumber);
  downloadLinkElement.href = wavBlobUrl;
  downloadLinkElement.download = "fractal_wav_file" + generationNumber +".wav";

  // 4. Graph the waveform.
  renderFractalAudioBufferToCanvas(audioBuffer, generationNumber);

  // 5. Optionally make waveform playable in the browser.
  // /* AudioBufferSourceNode */ var source = audioContext.createBufferSource();
  // source.buffer = fractalWaveformBuffer;
  // source.connect(audioContext.destination);
  // source.loop = true;
  // source.start();
}