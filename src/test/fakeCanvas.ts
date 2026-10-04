export function fakeCanvas(): HTMLElement {
  const listeners = { addEventListener() {}, removeEventListener() {} };
  return { ...listeners, style: {}, clientHeight: 900, getRootNode: () => listeners, ownerDocument: listeners } as unknown as HTMLElement;
}
