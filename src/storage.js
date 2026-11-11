// Read/write localStorage safely: if it fails (private window, full…),
// the app keeps working, it just can't remember.

export function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    console.warn(`Could not load ${key}:`, error);
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not save ${key}:`, error);
  }
}
