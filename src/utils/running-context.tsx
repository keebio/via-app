export const isElectron = /Electron/.test(navigator.userAgent);
export const isLinux =
  /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
