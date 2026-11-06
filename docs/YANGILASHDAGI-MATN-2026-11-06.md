# Sahifa yangilangandagi matn chaqnashi — 2026-11-06

Google uchun qo‘shilgan oddiy HTML xizmatlar ro‘yxati `#app` ichida turgani sababli JavaScript tayyor bo‘lguncha bir zum ko‘rinib qolgan. Foydalanuvchi uni olib tashlashni so‘radi.

Boshlang‘ich `#app` endi faqat bo‘sh `main.startup` elementidan iborat; ro‘yxat ekranda chaqnamaydi. JavaScript o‘chiq brauzerlar uchun tushuntirish/xizmat havolalari `noscript` ichida saqlandi. Canonical, sitemap, alohida 18 ochiq sahifa va Google tasdiqlash fayli saqlandi. Oddiy sahifa dizayni va Telegram ro‘yxatdan o‘tish kodi o‘zgartirilmadi.

`scripts/build-search-pages.mjs` ham tuzatildi: keyingi generatsiyada eski chaqnash qaytmaydi. Mavjud 3 ta SEO testi o‘tdi; generator takroriy ishlashi va boshlang‘ich app ichida ro‘yxat yo‘qligi tekshirildi.

Faqat index o‘zgarishi izolyatsiyalangan relizdan chiqarildi. Production: `dpl_BSzz572kjPYQfbbRrDfsQN6wrCCR`; oldingi: `dpl_HJyBz9AWV1BCsE6tuxubi8X3Vh4D`. Jonli HTTP tekshiruvi va oldingi app/registration/SEO fayllari mosligi `.cache/registration-1106/startup-fix.json` da qayd etildi.
