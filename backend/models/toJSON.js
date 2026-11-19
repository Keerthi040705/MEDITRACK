/**
 * Mongoose plugin: exposes `id` (string) instead of `_id`, hides `__v`,
 * and NEVER sends the password hash to the browser.
 */
module.exports = function toJSONPlugin(schema) {
  const transform = (doc, ret) => {
    if (ret._id !== undefined) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    delete ret.__v;
    delete ret.password;
    return ret;
  };
  schema.set('toJSON', { versionKey: false, transform });
  schema.set('toObject', { versionKey: false, transform });
};
