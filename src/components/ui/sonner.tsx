"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

/* ملاحظة: نستخدم مزوّد ثيم مخصص (بلا next-themes) —
   هذا الغلاف يراقب فئة .dark على <html> ليتلوّن الـ Toast مع الوضع الليلي،
   ويراقب اتجاه اللغة (dir) ليتحرك الـ Toast وينسحب للإغلاق باتجاه اللغة:
   سحب أفقي بأي من الاتجاهين (يمين/يسار) يغلق التنبيه */

function useThemeAndDir(): { theme: "dark" | "light"; dir: "rtl" | "ltr" } {
  const [state, setState] = useState<{ theme: "dark" | "light"; dir: "rtl" | "ltr" }>({
    theme: "light",
    dir: "rtl",
  })
  useEffect(() => {
    const el = document.documentElement
    const sync = () =>
      setState({
        theme: el.classList.contains("dark") ? "dark" : "light",
        dir: el.getAttribute("dir") === "ltr" ? "ltr" : "rtl",
      })
    sync()
    const ob = new MutationObserver(sync)
    ob.observe(el, { attributes: true, attributeFilter: ["class", "dir"] })
    return () => ob.disconnect()
  }, [])
  return state
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, dir } = useThemeAndDir()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={dir as ToasterProps["dir"]}
      className="toaster group"
      /* مدة التنبيه لا تتجاوز 4 ثوانٍ أبداً — طلب المستخدم */
      duration={4000}
      /* السحب للإغلاق باتجاهي اليمين واليسار — نمط طمأنينة */
      swipeDirections={["left", "right"]}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
