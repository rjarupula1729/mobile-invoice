// Generate a new access key for Mobile Invoice.
// Run:  node make-key.js
// Give the printed key to the buyer; add the printed hash to keys.json.
const crypto = require('crypto');

const key = 'VEG-'
  + crypto.randomBytes(2).toString('hex').toUpperCase()
  + '-'
  + crypto.randomBytes(2).toString('hex').toUpperCase();
const hash = crypto.createHash('sha256').update(key).digest('hex');

console.log('Key for buyer:', key);
console.log('Add to keys.json keys array:', '"' + hash + '"');
