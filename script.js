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

const generator = new LinearFractal([
    new Point(0.0, -0.5),
    new Point(0.3, -0.3),  
    new Point(0.7, 0.35),
    new Point(1.0, -0.4)]);

const initiator = new LinearFractal([
  new Point(0.0, 0.0),
  new Point(1 - 0.618, 0.5),  
  new Point(0.618, -0.5),
  new Point(1.0, 0.0),
]);

const numGenerations = 7;
let resultFractal = initiator;
// let resultFractal = generator;
for (let i = 0; i < numGenerations; i++) {
  resultFractal = iterateFractal(resultFractal, generator)
}

const X = resultFractal.X();
const Y = resultFractal.Y();


// 2. Convert the data into an AudioBuffer.
var audioContext = new AudioContext();
console.log("Number of fractal points: " + X.length);

var numChannels = 1
var waveformLength = 44100 // 1 second of audio
var sampleRate = 44100

// Create an empty audio buffer within the context that has the 
// desired properties.
/* AudioBuffer */ var fractalWaveformBuffer = audioContext.createBuffer(/*numOfChannels*/ 1, waveformLength, sampleRate);

/* Float32Array */ var audioBuffer = fractalWaveformBuffer.getChannelData(0);
var currentMaxFractalXIndex = 1;
for (var i = 0; i < waveformLength; i++) {
  var sampleXPoint = i / waveformLength;
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

// 3. Convert the AudioBuffer into a WAV file.
var audioBitRate = 16; // 16 bit audio
var audioByteRate = audioBitRate / 8;
var wavHeaderLength = 44;
var wavLength = wavHeaderLength + audioBuffer.length * audioByteRate * numChannels; // bytes
var wavBuffer = new ArrayBuffer(wavLength);
var wavDataView = new DataView(wavBuffer);
wavDataView.setUint32(0, 0x46464952, true); // "RIFF"
wavDataView.setUint32(4, wavLength - 8, true);
wavDataView.setUint32(8, 0x45564157, true); // "WAVE"
wavDataView.setUint32(12, 0x20746d66, true); // "fmt"
wavDataView.setUint32(16, 16, true); // length of format data
wavDataView.setUint16(20, 1, true); // format type 1, PCM uncompressed
wavDataView.setUint16(22, numChannels, true);
wavDataView.setUint32(24, sampleRate, true);
wavDataView.setUint32(28, sampleRate * audioByteRate * numChannels, true);
wavDataView.setUint16(32, audioByteRate * numChannels, true);
wavDataView.setUint16(34, audioBitRate, true);
wavDataView.setUint32(36, 0x61746164, true); // "data"
wavDataView.setUint32(40, wavLength - 44, true); // length of the data in bytes

var waveBytePosition = 44;
for (var i = 0; i < audioBuffer.length; i++) {
  var value = audioBuffer[i]; // 32 bit float
  if (value < 0) {
    value *= 32767;
  } else {
    value *= 32768;
  }
  wavDataView.setInt16(waveBytePosition, value, true);
  waveBytePosition += 2;
}

var wavBlob = new Blob([wavBuffer], {type: 'audio/wave'});

var wavBlobUrl = URL.createObjectURL(wavBlob);
var downloadLinkElement = document.getElementById('downloadLink');
downloadLinkElement.href = wavBlobUrl;
downloadLinkElement.download = "fractal_wav_file.wav";

// 4. Graph the waveform.
var canvas = document.getElementById('canvas');
canvas.setAttribute('width', window.innerWidth * 0.9);
canvas.setAttribute('height', window.innerHeight * 0.9);
var width = canvas.getAttribute('width');
var height = canvas.getAttribute('height');
console.log(width + "x" + height);
var ctx = canvas.getContext('2d');

var xStepSize = width / waveformLength;
ctx.moveTo(0, height - (height * (1.0 + audioBuffer[0])));

for (var i = 1; i < waveformLength; i += 10) {
  var x = xStepSize * i;
  var y = height - (height * ((1.0 + audioBuffer[i]) / 2));
  ctx.lineTo(x, y);
  ctx.stroke();
}

// 5. Optionally make waveform playable in the browser.
/* AudioBufferSourceNode */ var source = audioContext.createBufferSource();
source.buffer = fractalWaveformBuffer;
source.connect(audioContext.destination);
// source.loop = true;
// source.start();