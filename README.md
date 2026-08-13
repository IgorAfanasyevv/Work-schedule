# מוקד סידורים · 24/7

מערכת חכמה לבניית סידור עבודה שבועי לעמדה שפועלת 24/7 — React + TypeScript + Vite, עם נתונים משותפים בין כל מי שפותח את הקישור (Firebase Firestore).

## הרצה מקומית (בלי מסד נתונים משותף)

```bash
npm install
npm run dev
```

יפתח שרת פיתוח בכתובת `http://localhost:5173`. בלי הגדרת Firebase (ראו למטה) האפליקציה עובדת מצוין, רק שהנתונים נשמרים ב-`localStorage` של הדפדפן בלבד — כל מי שפותח את הקישור רואה עותק נפרד ולא משותף. יש על כך גם התראה קטנה בסיידבר.

## הגדרת מסד נתונים משותף (Firebase) — כדי שכולם יראו את אותו הסידור

1. היכנסו ל-[console.firebase.google.com](https://console.firebase.google.com), **Add project** → תנו שם → אפשר לכבות Google Analytics (לא נדרש).
2. בתפריט הצד: **Build → Firestore Database → Create database**. בחרו **Start in production mode**, ואז כל אזור (region) שנוח לכם.
3. בלשונית **Rules** של Firestore, מחקו את התוכן הקיים והדביקו את התוכן של `firebase/firestore.rules` (נמצא בתיקייה הזו) → **Publish**. זה פותח קריאה/כתיבה לכולם למסמך המשותף היחיד שהאפליקציה משתמשת בו — ראו את ההערה בקובץ לגבי אבטחה.
4. בתפריט הצד: **Project settings** (גלגל שיניים) → גללו למטה ל-**Your apps** → לחצו על סמל ה-Web `</>` → תנו שם לאפליקציה → **Register app**. תופיע בלוק קוד עם `firebaseConfig` שמכיל את כל הערכים שצריך.
5. צרו קובץ `.env.local` (מבוסס על `.env.example`) והעתיקו לתוכו את הערכים מ-`firebaseConfig`:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
   ```
6. הריצו מחדש `npm run dev` — ההתראה על "מצב מקומי" אמורה להיעלם, וכל שינוי שתעשו יישמר ב-Firestore ויופיע אצל כולם מיידית (בלי רענון), בזכות `onSnapshot`.

⚠️ **חשוב להבין**: אין באפליקציה מסך התחברות/הרשאות. כל מי שיש לו את הקישור יכול לצפות **ולערוך** (כללי ה-Rules שהדבקתם פותחים גישה מלאה). זה בסדר גמור לצוות קטן שעובד מול קישור פרטי, אבל אם צריך הבחנה בין "מנהל שעורך" ל"עובד שרק צופה" — צריך להוסיף Firebase Authentication ולצמצם את ה-Rules בהתאם. אפשר לבקש ממני לעשות את זה בהמשך.

## פריסה לאינטרנט (כדי לשלוח קישור שכולם יוכלו להשתמש בו)

הכי פשוט: **Vercel** (חינמי, בונה אוטומטית מ-GitHub).

1. ודאו שהפרויקט כבר ב-GitHub (ראו סעיף למטה).
2. היכנסו ל-[vercel.com](https://vercel.com) → **Add New → Project** → בחרו את הריפו שלכם.
3. Vercel יזהה אוטומטית שזה פרויקט Vite (Framework Preset: Vite). השאירו את ברירת המחדל (`npm run build`, תיקיית פלט `dist`).
4. לפני הפריסה, תחת **Environment Variables** הוסיפו את כל שישה משתני ה-`VITE_FIREBASE_...` מלמעלה — בלעדיהם האתר החי יעבוד במצב מקומי-בלבד לכל מבקר.
5. לחצו **Deploy**. תוך דקה תקבלו כתובת ציבורית כמו `https://shift-scheduler-yourname.vercel.app` — זו הכתובת שתשלחו הלאה. כל דחיפה עתידית ל-`main` תעדכן את האתר החי אוטומטית.

חלופה שקולה: **Netlify**, או גם **Firebase Hosting** עצמו (הגיוני מאוד כשכבר יש לכם פרויקט Firebase) — אותו תהליך בדיוק (`npm run build`, תיקיית `dist`), עם `firebase deploy` במקום.

## מבנה הפרויקט

```
src/
  types.ts                 # טיפוסים משותפים (Employee, ShiftInstance, ...)
  engine.ts                 # מנוע התכנון הטהור: זמינות, חפיפות, הוגנות, CSP, חיפוש מחליפים
  firebaseClient.ts          # חיבור ל-Firebase (מזוהה אוטומטית לפי משתני הסביבה)
  state.ts                    # טעינה/שמירה — Firestore אם מוגדר, אחרת localStorage
  SchedulerContext.tsx         # React Context עם כל הפעולות (assign/generate/recalc/...)
  App.tsx                       # שלד האפליקציה + ניווט בין טאבים
  components/
    Dashboard.tsx, ScheduleView.tsx, MyShifts.tsx, Employees.tsx,
    ShiftTypes.tsx, AuditLog.tsx, ModalHost.tsx
    modals/                     # כל אחד ממודלי העריכה
    ui/                          # Modal, Toasts גנריים
firebase/
  firestore.rules                # מדיניות הגישה למסמך המשותף
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
