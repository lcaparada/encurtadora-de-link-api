const charset =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateSlug(length = 6) {
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += charset[Math.floor(Math.random() * charset.length)];
  }
  return slug;
}
