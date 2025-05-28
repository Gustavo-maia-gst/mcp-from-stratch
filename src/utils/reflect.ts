export const forEachMethod = (
  target: Function,
  callback: (proto: any, method: string) => void
) => {
  const proto = target.prototype;
  const methods = Object.getOwnPropertyNames(proto).filter(
    (prop) => prop !== "constructor"
  );

  for (const method of methods) {
    callback(proto, method);
  }
};
