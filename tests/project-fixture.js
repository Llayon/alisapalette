export function projectFixture() {
  return {
    schemaVersion: 1, id: 'project-1', name: 'Моя палитра', revision: 0,
    createdAt: 1, updatedAt: 2,
    photo: { width: 100, height: 100, label: 'Фото.png', isDemo: false },
    palette: [{ id: 'pin-1', r: 12, g: 34, b: 56, x: 0.4, y: 0.6,
      count: 100, percentage: 100, center: { L: 0.5, a: -0.1, b: 0.2 }, role: 'primary' }],
    selectedColorId: 'pin-1',
    analysis: { algorithm: 'photo', colorCount: 6, minDelta: 28, kernelSize: 3, sortBy: 'dominance' },
    story: { template: 'editorial', title: 'Мой день', channel: '', count: 5,
      showNames: true, showHex: true, showPct: false, fit: 'cover', cropX: 0.2, cropY: 0.7 }
  };
}
