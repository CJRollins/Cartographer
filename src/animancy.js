export const spiritus = (t, f, a) => Math.sin(t * f * Math.PI * 2) * a;

export const fermentum = (t, s) => {
  const x = t * s;
  return (Math.sin(x * 127.1 + Math.cos(x * 311.7)) * 0.5 + 0.5) * 2 - 1;
};

export const inter = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
