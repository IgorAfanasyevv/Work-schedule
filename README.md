# מוקד סידורים · 24/7

מערכת חכמה לבניית סידור עבודה שבועי לעמדה שפועלת 24/7 — React + TypeScript + Vite, עם נתונים משותפים בין כל מי שפותח את הקישור (Supabase).

## הרצה מקומית (בלי מסד נתונים משותף)

```bash
npm install
npm run dev
```

יפתח שרת פיתוח בכתובת `http://localhost:5173`. בלי הגדרת Supabase (ראו למטה) האפליקציה עובדת מצוין, רק שהנתונים נשמרים ב-`localStorage` של הדפדפן בלבד — כל מי שפותח את הקישור רואה עותק נפרד ולא משותף. יש על כך גם התראה קטנה בסיידבר.

## הגדרת מסד נתונים משותף (Supabase) — כדי שכולם יראו את אותו הסידור

1. הרשמו בחינם ב-[supabase.com](https://supabase.com) וצרו פרויקט חדש.
2. בפרויקט: **SQL Editor → New query**, הדביקו את התוכן של `supabase/schema.sql` (נמצא בתיקייה הזו) והריצו. זה יוצר טבלה אחת (`app_state`) עם שורה משותפת אחת, ומפעיל realtime עליה כך שכל שינוי מופיע אצל כולם מיידית, בלי לרענן.
3. **Project Settings → API**, העתיקו את `Project URL` ואת `anon public key`.
4. צרו קובץ `.env.local` (מבוסס על `.env.example`) עם:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. הריצו מחדש `npm run dev` — ההתראה על "מצב מקומי" אמורה להיעלם, וכל שינוי שתעשו יישמר במסד הנתונים המשותף.

⚠️ **חשוב להבין**: אין באפליקציה מסך התחברות/הרשאות. כל מי שיש לו את הקישור יכול לצפות **ולערוך**. זה בסדר גמור לצוות קטן שעובד מול קישור פרטי, אבל אם צריך הבחנה בין "מנהל שעורך" ל"עובד שרק צופה" — צריך להוסיף Supabase Auth (אפשר לבקש ממני לעשות את זה בהמשך).

## פריסה לאינטרנט (כדי לשלוח קישור שכולם יוכלו להשתמש בו)

הכי פשוט: **Vercel** (חינמי, בונה אוטומטית מ-GitHub).

1. ודאו שהפרויקט כבר ב-GitHub (ראו סעיף למטה).
2. היכנסו ל-[vercel.com](https://vercel.com) → **Add New → Project** → בחרו את הריפו שלכם.
3. Vercel יזהה אוטומטית שזה פרויקט Vite (Framework Preset: Vite). השאירו את ברירת המחדל (`npm run build`, תיקיית פלט `dist`).
4. לפני הפריסה, תחת **Environment Variables** הוסיפו את שני המשתנים מ-Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — בלעדיהם האתר החי יעבוד במצב מקומי-בלבד לכל מבקר.
5. לחצו **Deploy**. תוך דקה תקבלו כתובת ציבורית כמו `https://shift-scheduler-yourname.vercel.app` — זו הכתובת שתשלחו הלאה. כל דחיפה עתידית ל-`main` תעדכן את האתר החי אוטומטית.

חלופה שקולה: **Netlify** — אותו תהליך בדיוק (חיבור לריפו, `npm run build`, תיקיית `dist`, אותם משתני סביבה).

## מבנה הפרויקט

```
src/
  types.ts                 # טיפוסים משותפים (Employee, ShiftInstance, ...)
  engine.ts                 # מנוע התכנון הטהור: זמינות, חפיפות, הוגנות, CSP, חיפוש מחליפים
  supabaseClient.ts          # חיבור ל-Supabase (מזוהה אוטומטית לפי משתני הסביבה)
  state.ts                    # טעינה/שמירה — Supabase אם מוגדר, אחרת localStorage
  SchedulerContext.tsx         # React Context עם כל הפעולות (assign/generate/recalc/...)
  App.tsx                       # שלד האפליקציה + ניווט בין טאבים
  components/
    Dashboard.tsx, ScheduleView.tsx, MyShifts.tsx, Employees.tsx,
    ShiftTypes.tsx, AuditLog.tsx, ModalHost.tsx
    modals/                     # כל אחד ממודלי העריכה
    ui/                          # Modal, Toasts גנריים
supabase/
  schema.sql                     # יוצר את הטבלה המשותפת + מדיניות גישה + realtime
```

## העלאה ל-GitHub (מ-WebStorm)

1. ב-WebStorm: `VCS → Create Git Repository…` בתיקיית הפרויקט (אם עוד לא Git repo).
2. `git add -A && git commit -m "Initial commit"`.
3. ב-GitHub צרו repository ריק (בלי README), העתיקו את ה-URL שלו.
4. ב-WebStorm: `Git → Push`, ואז הוסיפו remote אם נדרש:
   ```bash
   git remote add origin <REPO_URL>
   git branch -M main
   git push -u origin main
   ```

⚠️ אל תעלו את `.env.local` ל-GitHub (הוא כבר ב-`.gitignore`) — המפתחות שייכים בהגדרות הסביבה של Vercel/Netlify, לא בקוד.

## איך להמשיך לעבוד על זה איתי (Claude)

בצ'אט הזה אני יכול לייצר עבורכם קבצים/שינויים חדשים שתעתיקו ותעשו להם commit בעצמכם ב-WebStorm.

אם תרצו זרימת עבודה נוחה יותר, שבה אני יכול לקרוא את הריפו, לערוך קבצים ולעשות commit/push ישירות מהמחשב שלכם — זה בדיוק התפקיד של **Claude Code** (אפליקציית שולחן עבודה / תוסף ל-WebStorm/VS Code של Anthropic). מריצים אותו בתוך הריפו המקומי שלכם והוא עובד ישירות מול ה-git history האמיתי.

