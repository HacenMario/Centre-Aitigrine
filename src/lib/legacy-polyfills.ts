/**
 * ★ v3.26 — polyfills للمتصفحات القديمة (iPhone 8 / iOS ≤ 16 Safari)
 * • يُستورد ساكنًا في القارئ قبل تحميل pdf.js — يضمن مزايا ES2024 التي تستخدمها
 *   مكتبة pdf.js (Promise.withResolvers وغيرها) على المتصفحات الأقدم من iOS 17.4
 * • لا يؤثر على المتصفحات الحديثة: كل تعريف يشترط غياب الميزة أولاً
 */

/* Promise.withResolvers — Safari 17.4+ فقط دون هذا البديل */
type WithResolvers<T> = () => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

if (typeof Promise !== "undefined" && typeof (Promise as unknown as { withResolvers?: WithResolvers<unknown> }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: WithResolvers<unknown> }).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  } as WithResolvers<unknown>;
}

/* Array.prototype.at — Safari ≤ 15.3 */
if (typeof Array !== "undefined" && !Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", {
    writable: true,
    configurable: true,
    enumerable: false,
    value: function at(n: number) {
      const len = Number(this.length);
      const i = Math.trunc(Number(n) || 0);
      const k = i < 0 ? len + i : i;
      return k >= 0 && k < len ? this[k] : undefined;
    },
  });
}

/* Object.hasOwn — Safari ≤ 15.3 */
if (typeof Object !== "undefined" && !Object.hasOwn) {
  Object.defineProperty(Object, "hasOwn", {
    writable: true,
    configurable: true,
    enumerable: false,
    value: function hasOwn(o: object, k: PropertyKey) {
      return Object.prototype.hasOwnProperty.call(o, k);
    },
  });
}
