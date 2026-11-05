function padTo(buffer, size) {
  if (!size || size <= buffer.length) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(size - buffer.length, 0)]);
}

function makePng(size) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  return padTo(header, size);
}

function makeJpeg(size) {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  return padTo(header, size);
}

function makeWebp(size) {
  const header = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8 ', 'ascii')]);
  return padTo(header, size);
}

function makeGif() {
  return Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00', 'binary');
}

module.exports = { makePng, makeJpeg, makeWebp, makeGif };
