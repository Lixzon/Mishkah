const { createHash } = require('node:crypto');

module.exports = ({ config }) => {
  const masterKey = process.env.LIXZON_MASTER_KEY;
  if (masterKey && Buffer.byteLength(masterKey, 'utf8') < 32) {
    throw new Error('LIXZON_MASTER_KEY must be at least 32 bytes; generate a strong random key.');
  }

  const extra = { ...config.extra };
  if (masterKey) {
    extra.developerKeyDigest = createHash('sha256').update(masterKey, 'utf8').digest('hex');
  } else {
    delete extra.developerKeyDigest;
  }

  return {
    ...config,
    extra,
  };
};
