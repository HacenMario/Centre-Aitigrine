"use client";
/**
 * FullImage — الصورة تظهر كاملة دائماً (object-contain) في كل مكان بالموقع
 * الخلفية: نسخة ضبابية من نفس الصورة تملأ الفراغ (نفس مبدأ معرض «لمحة من داخل المركز»)
 * — لا يخرج أي جزء من الصورة خارج الإطار أبداً، في التكوينات والخدمات والأخصائيين
 *   والكتب الإلكترونية والمعارض ومعاينات الإدارة.
 */
import { cn } from "@/lib/utils";

export default function FullImage({
  src,
  alt = "",
  className,
  imgClassName,
  blurClassName = "opacity-40",
  rounded = "",
}: {
  src: string;
  alt?: string;
  /** صنف الحاوية — يحدد الحجم (مثال: h-44 w-full) */
  className?: string;
  imgClassName?: string;
  blurClassName?: string;
  rounded?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-muted", rounded, className)}>
      {/* خلفية ضبابية من نفس الصورة تملأ الفراغ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        className={cn("absolute inset-0 h-full w-full scale-110 object-cover blur-2xl", blurClassName)}
      />
      {/* الصورة كاملة — بلا قصّ إطلاقاً */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        className={cn("relative h-full w-full object-contain select-none drop-shadow-lg", imgClassName)}
      />
    </span>
  );
}

/** صورة بروفايل تظهر كاملة مع خلفية ضبابية — دائرية افتراضياً وقابلة لتغيير الاستدارة */
export function FullAvatar({
  src,
  alt = "",
  className = "h-20 w-20",
  imgClassName = "p-1",
  rounded = "rounded-full",
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  rounded?: string;
}) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20", rounded, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-50"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        className={cn("relative h-full w-full object-contain select-none drop-shadow", rounded, imgClassName)}
      />
    </span>
  );
}
