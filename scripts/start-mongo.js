/* تشغيل MongoDB في الذاكرة للمعاينة المحلية */
const { MongoMemoryServer } = require("mongodb-memory-server");
(async () => {
  /* ذاكرة كاش صغيرة + oplog مصغّر — يمنع قتل العملية في الأجهزة ضعيفة الذاكرة */
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: "ait_center",
      args: ["--wiredTigerCacheSizeGB=0.25", "--syncdelay=0"],
    },
  });
  console.log("MongoDB ready on", mongod.getUri());
  process.on("SIGINT", async () => { await mongod.stop(); process.exit(0); });
  process.on("SIGTERM", async () => { await mongod.stop(); process.exit(0); });
  /* نبض دوري: يسجل بقاء العملية ويسهّل تشخيص أي انطفاء */
  setInterval(() => console.log("MongoDB heartbeat ok", new Date().toISOString()), 60000);
  setInterval(() => {}, 1 << 30);
})().catch(e => { console.error("MONGO FAIL:", e.message); process.exit(1); });
