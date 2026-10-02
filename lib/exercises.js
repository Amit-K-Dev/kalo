// Exercise library — extracted from original Kalo
// Each: [id, name, category, muscles, howTo, defaultSets, defaultReps, unit, poseA, poseB]

const S0 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export const EX = [
  ["pu", "Push-up", "Chest", "Chest, triceps, shoulders", "Hands under shoulders, body in a straight line. Lower your chest, then press up.", 3, 12, "reps", [65, 0, 0, 0, 0, -65, -65, -65, -65], [78, -60, 60, -60, 60, -78, -78, -78, -78]],
  ["sq", "Squat", "Legs", "Quads, glutes", "Feet shoulder-width, chest up. Sit back and down until thighs are parallel, then stand.", 3, 15, "reps", S0, [25, 90, 90, 90, 90, 80, -10, 80, -10]],
  ["lu", "Lunge", "Legs", "Quads, glutes, hamstrings", "Step forward, drop the back knee toward the floor, push back to standing.", 3, 10, "reps", S0, [0, 0, 0, 0, 0, 85, -5, -20, -82]],
  ["dl", "Deadlift", "Back", "Hamstrings, glutes, back", "Hinge at the hips with a flat back, lower the weight along your legs, then stand tall.", 3, 8, "reps", S0, [70, 0, 0, 0, 0, 15, -10, 15, -10]],
  ["op", "Overhead press", "Shoulders", "Shoulders, triceps", "Start with weights at shoulder height, press straight overhead, lower with control.", 3, 10, "reps", [0, 20, 180, 20, 180, 0, 0, 0, 0], [0, 180, 180, 180, 180, 0, 0, 0, 0]],
  ["bc", "Bicep curl", "Biceps", "Biceps", "Elbows pinned to your sides. Curl the weights up, lower slowly.", 3, 12, "reps", S0, [0, 10, 120, 10, 120, 0, 0, 0, 0]],
  ["br", "Bent-over row", "Back", "Back, biceps", "Hinge forward with a flat back, pull the weights toward your ribs, lower slowly.", 3, 10, "reps", [65, 0, 0, 0, 0, 10, -10, 10, -10], [65, -55, -5, -55, -5, 10, -10, 10, -10]],
  ["gb", "Glute bridge", "Legs", "Glutes, hamstrings", "Lie on your back, knees bent. Drive your hips up until knees, hips and shoulders line up.", 3, 15, "reps", [-90, 90, 90, 90, 90, 125, 55, 125, 55], [-115, 100, 100, 100, 100, 120, 10, 120, 10]],
  ["pk", "Plank", "Core", "Abs, shoulders, glutes", "Forearms on the floor, body in one straight line. Brace your abs and hold.", 3, 30, "sec", [78, 0, 90, 0, 90, -78, -78, -78, -78], [80, 0, 90, 0, 90, -80, -80, -80, -80]],
  ["cr", "Crunch", "Core", "Abs", "Lie on your back, knees bent. Curl your shoulders off the floor, lower slowly.", 3, 15, "reps", [-90, 100, 100, 100, 100, 125, 55, 125, 55], [-55, 100, 100, 100, 100, 125, 55, 125, 55]],
  ["lr", "Leg raise", "Core", "Lower abs, hip flexors", "Lie flat, legs straight. Raise them to vertical, then lower without touching the floor.", 3, 12, "reps", [-90, 90, 90, 90, 90, 90, 90, 90, 90], [-90, 90, 90, 90, 90, 175, 175, 175, 175]],
  ["rt", "Russian twist", "Core", "Obliques, abs", "Sit leaning back with feet raised. Rotate your arms side to side.", 3, 20, "reps", [-35, 100, 100, 100, 100, 125, 125, 125, 125], [-35, 60, 60, 60, 60, 125, 125, 125, 125]],
  ["rn", "Running", "Cardio", "Legs, heart", "Run at a steady pace, landing under your hips with relaxed shoulders and swinging arms.", 1, 20, "min", [12, -45, 40, 50, 140, 60, -15, -30, -110], [12, 50, 140, -45, 40, -30, -110, 60, -15]],
  ["hk", "High knees", "Cardio", "Hip flexors, calves, heart", "Run in place, driving each knee to hip height and pumping your arms.", 3, 30, "sec", [5, -40, 30, 40, 120, 100, 0, 0, 0], [5, 40, 120, -40, 30, 0, 0, 100, 0]],
  ["sb", "Shadow boxing", "Cardio", "Shoulders, core, heart", "Staggered stance, hands up. Throw fast straight punches, rotating your hips.", 3, 60, "sec", [0, 20, 150, 20, 150, 25, 10, -25, -15], [8, 90, 90, 20, 150, 25, 10, -25, -15]],
  ["jj", "Jumping jacks", "HIIT", "Full body, heart", "Jump feet apart while swinging arms overhead, then jump back together.", 4, 30, "sec", S0, [0, 150, 150, -150, -150, 25, 25, -25, -25]],
  ["mc", "Mountain climbers", "HIIT", "Core, shoulders, legs", "From a high plank, drive your knees toward your chest one after the other, fast.", 4, 30, "sec", [65, 0, 0, 0, 0, -65, -65, -65, -65], [65, 0, 0, 0, 0, 75, -20, -65, -65]],
  ["qs", "Quad stretch", "Stretch", "Quads", "Stand tall, pull one heel to your glute, keep knees together. Hold, then switch.", 2, 30, "sec", S0, [0, -25, -125, 0, 0, -5, -145, 0, 0]],
  ["ff", "Forward fold", "Stretch", "Hamstrings, lower back", "Hinge at the hips and let your upper body hang toward the floor. Soft knees.", 2, 30, "sec", S0, [150, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["co", "Cobra", "Stretch", "Abs, spine, chest", "Lie face down, press your chest up with hands under shoulders. Hips stay down.", 2, 30, "sec", [88, -10, 60, -10, 60, -88, -88, -88, -88], [50, 0, 60, 0, 60, -85, -85, -85, -85]],
  ["wr", "Warrior pose", "Stretch", "Legs, hips, shoulders", "Deep lunge, front knee over ankle. Raise your arms overhead, then open them wide.", 2, 30, "sec", [0, 180, 180, 180, 180, 60, -5, -40, -40], [0, 90, 90, -90, -90, 60, -5, -40, -40]],
  ["tr", "Tree pose", "Stretch", "Balance, hips, core", "Stand on one leg, sole of the other foot on your inner calf or thigh. Raise your arms.", 2, 30, "sec", [0, 40, 150, 40, 150, 0, 0, 70, -70], [0, 170, 170, 170, 170, 0, 0, 70, -70]],
  ["bp", "Barbell bench press", "Chest", "Pecs, triceps, front delts", "Lie on a bench, lower the bar to mid-chest, press it back up over your shoulders.", 4, 8, "reps", [-90, 100, 175, 100, 175, 125, 55, 125, 55], [-90, 180, 180, 180, 180, 125, 55, 125, 55]],
  ["ip", "Incline dumbbell press", "Chest", "Upper chest, shoulders", "Bench at 30–45°. Lower the dumbbells beside your chest, press up and slightly together.", 3, 10, "reps", [-40, 100, 175, 100, 175, 90, 5, 90, 5], [-40, 170, 175, 170, 175, 90, 5, 90, 5]],
  ["df", "Dumbbell fly", "Chest", "Pecs", "Lie flat, arms nearly straight. Open them wide in an arc, then squeeze back over your chest.", 3, 12, "reps", [-90, 180, 180, 180, 180, 125, 55, 125, 55], [-90, -115, -115, -115, -115, 125, 55, 125, 55]],
  ["cx", "Cable crossover", "Chest", "Pecs (inner chest)", "Cables set high. Step forward and sweep your hands down and together in front of you.", 3, 12, "reps", [15, -120, -120, -120, -120, 20, 5, -20, -10], [15, 40, 40, 40, 40, 20, 5, -20, -10]],
  ["cd", "Chest dips", "Chest", "Lower chest, triceps, shoulders", "On parallel bars lean forward and lower until elbows hit 90°, then press up.", 3, 10, "reps", [15, 0, 0, 0, 0, 15, -115, 10, -105], [22, -35, 10, -35, 10, 15, -115, 10, -105]],
  ["wp", "Wide push-up", "Chest", "Outer chest, shoulders", "Push-up with hands wider than your shoulders. Same motion, more chest.", 3, 12, "reps", [65, 0, 0, 0, 0, -65, -65, -65, -65], [78, -60, 60, -60, 60, -78, -78, -78, -78]],
  ["dp", "Decline push-up", "Chest", "Upper chest, shoulders", "Feet on a bench, hands on the floor. Lower your chest, press back up.", 3, 10, "reps", [100, 0, 0, 0, 0, -100, -100, -100, -100], [112, -60, 60, -60, 60, -112, -112, -112, -112]],
  ["ic", "Incline push-up", "Chest", "Lower chest, shoulders (easier)", "Hands on a bench or counter, body straight. Lower your chest to it, press away.", 3, 15, "reps", [41, 0, 0, 0, 0, -41, -41, -41, -41], [57, -60, 60, -60, 60, -57, -57, -57, -57]],
  ["pl", "Pull-up", "Back", "Lats, biceps, upper back", "Hang from a bar, palms away. Pull your chest to the bar, lower under control.", 3, 6, "reps", [0, 180, 180, 180, 180, 5, -20, 0, -15], [0, -10, 175, -10, 175, 5, -20, 0, -15]],
  ["ld", "Lat pulldown", "Back", "Lats, biceps", "Seated, pull the bar down to your upper chest, elbows driving down. Return slowly.", 3, 10, "reps", [-10, 175, 175, 175, 175, 90, 0, 90, 0], [-10, 10, 160, 10, 160, 90, 0, 90, 0]],
  ["sr", "Seated cable row", "Back", "Mid-back, lats, biceps", "Sit tall, pull the handle to your belly and squeeze shoulder blades together.", 3, 12, "reps", [12, 90, 90, 90, 90, 95, 95, 95, 95], [-8, -60, 60, -60, 60, 95, 95, 95, 95]],
  ["ar", "One-arm dumbbell row", "Back", "Lats, rhomboids, biceps", "One hand on a bench, back flat. Row the dumbbell to your hip, lower slowly.", 3, 10, "reps", [80, 0, 0, 0, 0, -15, -8, -20, -60], [80, -60, -10, 0, 0, -15, -8, -20, -60]],
  ["sm", "Superman", "Back", "Lower back, glutes", "Lie face down. Lift arms, chest and legs off the floor together, hold, lower.", 3, 12, "reps", [90, 90, 90, 90, 90, -90, -90, -90, -90], [70, 120, 120, 120, 120, -120, -120, -120, -120]],
  ["lt", "Lateral raise", "Shoulders", "Side delts", "Dumbbells at your sides. Raise arms out to shoulder height with soft elbows, lower slowly.", 3, 12, "reps", S0, [0, 90, 90, -90, -90, 0, 0, 0, 0]],
  ["fr", "Front raise", "Shoulders", "Front delts", "Raise the weights straight in front of you to shoulder height, lower slowly.", 3, 12, "reps", S0, [0, 90, 90, 90, 90, 0, 0, 0, 0]],
  ["am", "Arnold press", "Shoulders", "All three delt heads", "Start palms facing you at chest height, rotate your palms out as you press overhead.", 3, 10, "reps", [0, 60, 175, 60, 175, 0, 0, 0, 0], [0, 180, 180, 180, 180, 0, 0, 0, 0]],
  ["rf", "Rear delt fly", "Shoulders", "Rear delts, upper back", "Hinge forward, arms hanging. Raise the weights out and back, squeezing your shoulder blades.", 3, 12, "reps", [70, 0, 0, 0, 0, 10, -10, 10, -10], [70, -35, -35, -35, -35, 10, -10, 10, -10]],
  ["fp", "Face pull", "Shoulders", "Rear delts, rotator cuff", "Cable at face height. Pull the rope toward your face, elbows high and wide.", 3, 15, "reps", [0, 90, 90, 90, 90, 15, 5, -15, -10], [0, 20, 170, 20, 170, 15, 5, -15, -10]],
  ["ur", "Upright row", "Shoulders", "Side delts, traps", "Hold the bar at your thighs. Pull it up along your body, elbows leading, to chest height.", 3, 10, "reps", S0, [0, 90, -30, 90, -30, 0, 0, 0, 0]],
  ["pp", "Pike push-up", "Shoulders", "Shoulders, triceps", "Hips high in an upside-down V. Bend your elbows to lower your head toward the floor, press up.", 3, 8, "reps", [135, 0, 0, 0, 0, -15, -15, -15, -15], [125, -50, 40, -50, 40, -20, -20, -20, -20]],
  ["hc", "Hammer curl", "Biceps", "Biceps, forearms", "Palms facing each other. Curl one dumbbell up without swinging, lower, then switch arms.", 3, 10, "reps", S0, [0, 0, 125, 0, 0, 0, 0, 0, 0]],
  ["cc", "Concentration curl", "Biceps", "Biceps peak", "Seated, elbow braced on your inner thigh. Curl the dumbbell up and squeeze at the top.", 3, 10, "reps", [45, 10, 0, 60, 60, 80, 0, 80, 0], [45, 10, 150, 60, 60, 80, 0, 80, 0]],
  ["pc", "Preacher curl", "Biceps", "Lower biceps", "Arms resting on the pad. Curl the bar up, lower until your arms are almost straight.", 3, 10, "reps", [20, 45, 45, 45, 45, 90, 5, 90, 5], [20, 45, 170, 45, 170, 90, 5, 90, 5]],
  ["ib", "Incline dumbbell curl", "Biceps", "Long head of biceps", "Recline on an incline bench with arms hanging behind you. Curl up, lower fully.", 3, 10, "reps", [-35, 0, 0, 0, 0, 90, 5, 90, 5], [-35, 0, 150, 0, 150, 90, 5, 90, 5]],
  ["bd", "Bench dips", "Triceps", "Triceps, front delts", "Hands on a bench behind you, legs forward. Lower until elbows reach 90°, press up.", 3, 12, "reps", [-8, -8, -8, -8, -8, 75, 5, 75, 5], [-8, -70, 10, -70, 10, 75, 5, 75, 5]],
  ["sk", "Skull crushers", "Triceps", "Triceps (long head)", "Lie down, elbows pointing up. Bend at the elbows to lower the bar to your forehead, extend.", 3, 10, "reps", [-90, 180, 180, 180, 180, 125, 55, 125, 55], [-90, 180, -50, 180, -50, 125, 55, 125, 55]],
  ["oe", "Overhead tricep extension", "Triceps", "Triceps (long head)", "Hold one weight overhead. Bend elbows to lower it behind your head, then extend.", 3, 12, "reps", [0, 180, 180, 180, 180, 0, 0, 0, 0], [0, 180, -30, 180, -30, 0, 0, 0, 0]],
  ["tp", "Tricep pushdown", "Triceps", "Triceps", "Elbows pinned to your sides. Push the cable bar down until your arms are straight.", 3, 12, "reps", [8, 5, 100, 5, 100, 15, 5, -15, -10], [8, 5, 5, 5, 5, 15, 5, -15, -10]],
  ["kb", "Tricep kickback", "Triceps", "Triceps", "Hinge forward, upper arm parallel to the floor. Extend the forearm back, squeeze, return.", 3, 12, "reps", [70, -85, 0, 0, 0, 10, -10, 10, -10], [70, -85, -90, 0, 0, 10, -10, 10, -10]],
  ["dm", "Diamond push-up", "Triceps", "Triceps, inner chest", "Hands together under your chest, thumbs and fingers forming a diamond. Lower, press up.", 3, 10, "reps", [65, 0, 0, 0, 0, -65, -65, -65, -65], [78, -60, 60, -60, 60, -78, -78, -78, -78]],
  ["cg", "Close-grip bench press", "Triceps", "Triceps, inner chest", "Bench press with hands shoulder-width apart and elbows tucked close to your sides.", 3, 8, "reps", [-90, 100, 175, 100, 175, 125, 55, 125, 55], [-90, 180, 180, 180, 180, 125, 55, 125, 55]]
];

export const CATS = ["All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Cardio", "HIIT", "Stretch"];

export const MET = { Chest: 5, Back: 5, Shoulders: 4.5, Biceps: 4, Triceps: 4, Legs: 5.5, Core: 4, Cardio: 8, HIIT: 9, Stretch: 2.5 };

export const TPL = [
  ["Full body", ["sq", "pu", "br", "lu", "pk"]],
  ["Push", ["bp", "ip", "lt", "op", "tp"]],
  ["Pull", ["pl", "ld", "sr", "ar", "bc"]],
  ["Arms", ["bc", "hc", "pc", "sk", "oe", "kb"]],
  ["Core", ["pk", "cr", "lr", "rt"]],
  ["HIIT", ["jj", "mc", "hk", "sq"]],
  ["Stretch", ["qs", "ff", "co", "wr", "tr"]]
];

export function getExercise(id) {
  return EX.find(e => e[0] === id);
}

export function getUnit(e) {
  return e[7] === "reps" ? "reps" : e[7];
}

export function estimateWorkout(items, weightKg) {
  let sec = 0, kc = 0;
  items.forEach(i => {
    const e = getExercise(i.id);
    if (!e) return;
    const t = (e[7] === "reps" ? i.reps * 3 : e[7] === "min" ? i.reps * 60 : i.reps) * i.sets + (i.sets > 1 ? (i.sets - 1) * 45 : 0);
    sec += t;
    kc += (MET[e[2]] || 4) * weightKg * t / 3600;
  });
  return { min: Math.max(1, Math.round(sec / 60)), kc: Math.round(kc) };
}
