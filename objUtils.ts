export function copy(obj: Record<string,any>, filter: (obj: Record<string,any>) => boolean = null) { // maybe improve to allow circular references later
  const copy = {};
  
  const queue: [root: object, next: object, key: string][] = Object.keys(obj).map(key => [copy, obj[key], key]);
  
  while (queue.length > 0) {
    const [root, next, key] = queue.pop();

    root[key] = next;
    if (typeof next == "object" && next != null && next.constructor.name != "object" && (filter === null || filter(next))) queue.push(...Object.keys(next).map(key => [root, next[key], key]) as [object, any, string][]);
  }
  return copy;
}

export function flatten(obj: Record<string, any>) {
  const queue: [ prefix: string, object: any ][] = [[ "", obj ]];
  const output = {};

  while (queue.length > 0) {
    const [prefix, object] = queue.pop();
    for (const key in object) {
      const name = (prefix.length == 0) ? key : `${prefix}.${key}`;
      if (typeof object == "object") queue.push([name, object]); // continue
      else output[name] = object; // end of branch
    }
  }
  return output;
}

export function getSubObject(
  obj: Record<string,any>,
  keys: string[],
  fallback = null
) {
  let root = obj;
  for (const key of keys) {
    if (typeof root != "object" || root == null) return fallback;
    if (!root.hasOwnProperty(key)) return fallback;
    root = root[key];
  }
  return root;
}

// takes encapsulation into account
export function smartSplit(str: string, splitters: string | string[], encapsulators?: Record<string,string>, allowInvalidEncapsulation?: boolean): string[]
export function smartSplit(str: string[], splitters: string | string[], encapsulators?: Record<string,string>, allowInvalidEncapsulation?: boolean): string[][]
export function smartSplit(
  str: string | string[],
  splitters: string | string[],
  encapsulators: Record<string,string> = {}, // key: start, value: end
  allowInvalidEncapsulation: boolean = true
) {
  if (!Array.isArray(splitters)) splitters = [splitters]; // turn string splitter into array of length 1
  const output: string[][] = [];
  const encapsulation = [];

  let temp: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (encapsulation.length > 0 && encapsulation[i] == char) { // remove encapsulation
      encapsulation.pop();
      continue;
    }

    if (encapsulators.hasOwnProperty(char)) {
      encapsulation.push(encapsulators[char]); // push ender into encapsulation
      continue;
    }

    if (encapsulation.length == 0 && splitters.includes(char)) {
      output.push(temp);
      temp = [];
      continue;
    }

    temp.push(char);
  }

  if (encapsulation.length == 0 || allowInvalidEncapsulation) output.push(temp);
  return (typeof str == "string") ? output.map(arr => arr.join("")) : output;
}

