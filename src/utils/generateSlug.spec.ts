import { generateSlug } from './generateSlug';

describe('generateSlug', () => {
  it('should generate a slug of default length 6', () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(6);
  });

  it('should generate a slug with custom length', () => {
    const slug = generateSlug(10);
    expect(slug).toHaveLength(10);
  });

  it('should only contain valid characters from charset', () => {
    const slug = generateSlug(20);
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (const char of slug) {
      expect(charset).toContain(char);
    }
  });

  it('should generate different slugs for multiple calls (not guaranteed, but probable)', () => {
    const slugs = new Set();
    for (let i = 0; i < 100; i++) {
      slugs.add(generateSlug());
    }
    // Probabilistic uniqueness (should be close to 100 unique slugs)
    expect(slugs.size).toBeGreaterThan(90);
  });
});
