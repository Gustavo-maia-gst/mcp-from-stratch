import { container } from "tsyringe";

export type Class<T = any> = new (...args: any[]) => T;

export const forEachMethod = (
  target: Class,
  callback: (proto: any, method: string) => void
) => {
  const proto = getPrototype(target);
  const methods = Object.getOwnPropertyNames(proto).filter(
    (prop) => prop !== "constructor"
  );

  for (const method of methods) {
    callback(proto, method);
  }
};

export const getPrototype = (target: Class) => {
  const instance = container.resolve(target);
  const proto = Object.getPrototypeOf(instance);
  return proto;
};
