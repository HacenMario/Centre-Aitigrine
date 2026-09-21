"use client";
/**
 * محدد موقع العيادة — Google Maps
 * زر GPS لتحديد موقعي + إدخال الإحداثيات يدوياً + معاينة مباشرة من خرائط Google
 * (iframe مدمج لا يحتاج مفتاح API)
 */
import { useState } from "react";
import { LocateFixed, MapPin, ExternalLink, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";

export const gmapsEmbed = (lat: number, lng: number, lang = "ar") =>
  `https://www.google.com/maps?q=${lat},${lng}&z=15&hl=${lang === "ar" ? "ar" : lang}&output=embed`;
export const gmapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default function MapPicker({
  lat,
  lng,
  onChange,
  height = "h-72",
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}) {
  const { t, lang } = useApp();
  const [la, setLa] = useState(String(lat));
  const [ln, setLn] = useState(String(lng));
  const [gpsBusy, setGpsBusy] = useState(false);

  const gps = () => {
    if (!navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const nlat = +p.coords.latitude.toFixed(6);
        const nlng = +p.coords.longitude.toFixed(6);
        setLa(String(nlat));
        setLn(String(nlng));
        onChange(nlat, nlng);
        setGpsBusy(false);
      },
      () => setGpsBusy(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const commit = (v: string, which: "lat" | "lng") => {
    const n = parseFloat(v);
    if (!isNaN(n)) {
      if (which === "lat") onChange(Math.max(-85, Math.min(85, n)), parseFloat(ln) || lng);
      else onChange(parseFloat(la) || lat, Math.max(-180, Math.min(180, n)));
    }
  };

  const nLat = parseFloat(la) || lat;
  const nLng = parseFloat(ln) || lng;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Compass className="h-4 w-4 shrink-0 text-primary" />
          {t("map.hint")}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={gps} disabled={gpsBusy} className="gap-1.5 rounded-full">
          <LocateFixed className={"h-4 w-4" + (gpsBusy ? " animate-pulse" : "")} />
          {t("map.gpsBtn")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="map-lat">{t("map.lat")}</Label>
          <Input id="map-lat" dir="ltr" inputMode="decimal" value={la}
            onChange={(e) => setLa(e.target.value)}
            onBlur={(e) => commit(e.target.value, "lat")} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="map-lng">{t("map.lng")}</Label>
          <Input id="map-lng" dir="ltr" inputMode="decimal" value={ln}
            onChange={(e) => setLn(e.target.value)}
            onBlur={(e) => commit(e.target.value, "lng")} className="rounded-xl" />
        </div>
      </div>

      <div className={`relative w-full ${height} rounded-2xl overflow-hidden ring-1 ring-border shadow-inner bg-muted`}>
        <iframe
          key={`${nLat},${nLng}`}
          title="Google Maps"
          src={gmapsEmbed(nLat, nLng, lang)}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <a href={gmapsLink(nLat, nLng)} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ExternalLink className="h-4 w-4" />
        {t("map.openGoogle")}
        <MapPin className="h-4 w-4" />
      </a>
    </div>
  );
}
