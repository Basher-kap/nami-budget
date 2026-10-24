// Nami palette: tangerine orange, Grand Line navy, sky blue, berry gold, Straw Hat red
export const C = {
  bg: '#FFF4E0', card: '#FFFFFF', navy: '#10304E', orange: '#FF8C1A', gold: '#F7B500',
  sky: '#2E9BDA', red: '#D62839', green: '#2E9E6B', muted: '#6B7C8F', line: '#F2C27A',
};
export const CURRENCY = '₱'; // Pesos (matches your mockup). Change to '฿' for Berries, '$', etc.
export const PAL = ['#FF8C1A', '#2E9BDA', '#D62839', '#F7B500', '#2E9E6B', '#8E5BD1', '#10304E'];
export const money = (n) =>
  `${CURRENCY}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
