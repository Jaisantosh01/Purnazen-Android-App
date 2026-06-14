"""Session catalog seed content.

Ported from the (now removed) frontend mock data so the players can run from
API content:
- mobile/src/data/yogaSessionData.js  -> WELLNESS_SESSIONS
- mobile/src/data/reliefSessionData.js -> RELIEF_SESSIONS

Keys match the sessionKey/reliefKey values the screens navigate with.
"""

_RELIEF_VIDEO = "https://res.cloudinary.com/dcngh7dkt/video/upload/Wrist_Pain_n2i3wq.mp4"

WELLNESS_SESSIONS = {
    "YogaSession": {
        "title": "Morning Yoga",
        "duration": "20 min",
        "icon": "🧘",
        "videoUrl": None,
        "totalCycles": 2,
        "steps": [
            {"id": 1, "name": "Mountain Pose", "description": "Stand tall, feet together, arms at sides. Breathe deeply.", "duration": 60},
            {"id": 2, "name": "Forward Fold", "description": "Hinge at hips, let head hang heavy toward the floor.", "duration": 45},
            {"id": 3, "name": "Downward Dog", "description": "Press palms flat, lift hips up and back, forming an inverted V.", "duration": 60},
            {"id": 4, "name": "Warrior I", "description": "Step one foot forward, bend front knee, raise arms overhead.", "duration": 45},
            {"id": 5, "name": "Child's Pose", "description": "Kneel, sit back on heels, extend arms forward and rest forehead down.", "duration": 60},
            {"id": 6, "name": "Savasana", "description": "Lie flat on your back, close eyes, and relax completely.", "duration": 90},
        ],
    },
    "MeditationSession": {
        "title": "Mindful Meditation",
        "duration": "15 min",
        "icon": "🧠",
        "videoUrl": None,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Settle In", "description": "Find a comfortable seated position. Close your eyes gently.", "duration": 60},
            {"id": 2, "name": "Body Scan", "description": "Bring awareness from your feet upward, releasing tension at each point.", "duration": 120},
            {"id": 3, "name": "Breath Awareness", "description": "Focus solely on the natural rhythm of your breath.", "duration": 180},
            {"id": 4, "name": "Loving Kindness", "description": "Silently wish yourself and others health, happiness, and peace.", "duration": 120},
            {"id": 5, "name": "Return & Open", "description": "Gently wiggle fingers and toes, then slowly open your eyes.", "duration": 60},
        ],
    },
    "BreathingSession": {
        "title": "Box Breathing",
        "duration": "10 min",
        "icon": "💨",
        "videoUrl": None,
        "totalCycles": 5,
        "steps": [
            {"id": 1, "name": "Inhale", "description": "Breathe in slowly through your nose for 4 counts.", "duration": 4},
            {"id": 2, "name": "Hold", "description": "Hold your breath gently for 4 counts.", "duration": 4},
            {"id": 3, "name": "Exhale", "description": "Breathe out slowly through your mouth for 4 counts.", "duration": 4},
            {"id": 4, "name": "Hold", "description": "Hold empty for 4 counts before the next inhale.", "duration": 4},
        ],
    },
    "MorningRoutineSession": {
        "title": "Morning Routine",
        "duration": "20 min",
        "icon": "☀️",
        "videoUrl": None,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Wake-Up Stretch", "description": "Lie on your back, extend arms overhead and stretch your whole body long.", "duration": 60},
            {"id": 2, "name": "Cat-Cow Flow", "description": "On hands and knees, alternate arching and rounding your spine with your breath.", "duration": 60},
            {"id": 3, "name": "Sun Salutation", "description": "Flow through a gentle sequence of forward fold, plank, and upward dog to warm the body.", "duration": 90},
            {"id": 4, "name": "Standing Balance", "description": "Stand on one foot, bend the other knee and hold. Builds focus and leg strength.", "duration": 60},
            {"id": 5, "name": "Hip Opener", "description": "Step one foot wide, lower into a low lunge, and open the chest upward.", "duration": 60},
            {"id": 6, "name": "Core Activation", "description": "Hold a forearm plank position, drawing the navel in and breathing steadily.", "duration": 45},
            {"id": 7, "name": "Energising Breath", "description": "Take 10 deep belly breaths — inhale for 4 counts, exhale for 6 counts.", "duration": 60},
            {"id": 8, "name": "Intention Setting", "description": "Sit quietly, close your eyes, and set a positive intention for the day ahead.", "duration": 45},
        ],
    },
    "EveningWindDown": {
        "title": "Evening Wind Down",
        "duration": "15 min",
        "icon": "🌙",
        "videoUrl": None,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Diaphragm Breathing", "description": "Sit comfortably, place a hand on your belly, and breathe deeply into it for 10 breaths.", "duration": 60},
            {"id": 2, "name": "Neck & Shoulder Release", "description": "Slowly roll the neck side to side and drop each ear toward the shoulder to release tension.", "duration": 60},
            {"id": 3, "name": "Seated Forward Fold", "description": "Extend legs forward, hinge at the hips and reach toward your feet. Hold and breathe.", "duration": 60},
            {"id": 4, "name": "Supine Spinal Twist", "description": "Lie on your back, hug one knee to your chest then guide it across your body. Repeat both sides.", "duration": 90},
            {"id": 5, "name": "Legs Up the Wall", "description": "Lie near a wall and rest your legs vertically against it. Promotes blood flow and calm.", "duration": 120},
            {"id": 6, "name": "Progressive Relaxation", "description": "Tense and release each muscle group from feet to face, letting the body melt into the floor.", "duration": 90},
            {"id": 7, "name": "Sleep Visualisation", "description": "Close your eyes and picture a calm, safe place. Breathe slowly until you feel at peace.", "duration": 60},
        ],
    },
    "FullBodyStretch": {
        "title": "Full Body Stretch",
        "duration": "12 min",
        "icon": "🤸",
        "videoUrl": None,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Neck Rolls", "description": "Gently roll the head in slow circles to release stiffness in the neck and upper traps.", "duration": 40},
            {"id": 2, "name": "Shoulder Cross Stretch", "description": "Pull one arm across your chest with the opposite hand. Hold 20 s each side.", "duration": 50},
            {"id": 3, "name": "Chest Opener", "description": "Interlace fingers behind your back, squeeze shoulder blades together and lift the arms slightly.", "duration": 45},
            {"id": 4, "name": "Side Body Stretch", "description": "Reach one arm overhead and lean to the opposite side, feeling the entire side of the body open.", "duration": 50},
            {"id": 5, "name": "Hip Flexor Lunge", "description": "Step into a low lunge and sink the back knee toward the floor, opening the front of the hip.", "duration": 60},
            {"id": 6, "name": "Standing Hamstring Stretch", "description": "With straight legs, hinge at the hips and reach toward the floor or shins.", "duration": 50},
            {"id": 7, "name": "Seated Pigeon Pose", "description": "Sit on the floor, cross one ankle over the opposite knee, and gently press the knee down.", "duration": 60},
            {"id": 8, "name": "Spinal Twist", "description": "Seated with legs extended, bend one knee, cross the foot over and twist toward it.", "duration": 50},
            {"id": 9, "name": "Child's Pose", "description": "Kneel, sit back on heels, extend arms forward and let the forehead rest on the mat.", "duration": 60},
        ],
    },
}

RELIEF_SESSIONS = {
    "Headache": {
        "title": "Headache Relief",
        "duration": "5 min",
        "icon": "🧠",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Temple Points", "description": "Apply gentle pressure on both temples in a slow circular motion.", "duration": 30},
            {"id": 2, "name": "Third Eye Point", "description": "Press the point between your eyebrows firmly for relief.", "duration": 30},
            {"id": 3, "name": "Base of Skull", "description": "Press the hollow points at the base of your skull on both sides.", "duration": 30},
            {"id": 4, "name": "Hand Valley Point", "description": "Squeeze the web between your thumb and index finger firmly.", "duration": 30},
        ],
    },
    "Neck Pain": {
        "title": "Neck Pain Relief",
        "duration": "5 min",
        "icon": "⚡",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Shoulder Well", "description": "Press the midpoint of the shoulder muscle firmly with your fingers.", "duration": 30},
            {"id": 2, "name": "Wind Pool", "description": "Press the hollow points at the base of your skull on both sides.", "duration": 30},
            {"id": 3, "name": "Heavenly Pillar", "description": "Press the muscles on either side of the spine at the back of the neck.", "duration": 30},
            {"id": 4, "name": "Neck Side Stretch", "description": "Gently tilt your head toward each shoulder and hold to release tension.", "duration": 30},
        ],
    },
    "Back Pain": {
        "title": "Back Pain Relief",
        "duration": "6 min",
        "icon": "🔥",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Lower Back Points", "description": "Press points on either side of the spine just above the hips.", "duration": 30},
            {"id": 2, "name": "Hip Bone Points", "description": "Press firmly on the top of the hip bones on both sides.", "duration": 30},
            {"id": 3, "name": "Behind Knee Points", "description": "Press the center point behind each knee to relieve back tension.", "duration": 30},
            {"id": 4, "name": "Foot Arch Press", "description": "Press the arch of your foot to stimulate the lower back reflex point.", "duration": 30},
        ],
    },
    "Stress Relief": {
        "title": "Stress Relief",
        "duration": "6 min",
        "icon": "🌬️",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 2,
        "steps": [
            {"id": 1, "name": "Third Eye Point", "description": "Press the point between your eyebrows gently and breathe deeply.", "duration": 60},
            {"id": 2, "name": "Inner Wrist Point", "description": "Press the inside of your wrist, two finger-widths from the crease.", "duration": 60},
            {"id": 3, "name": "Heart Point", "description": "Press the outer wrist crease below the little finger to calm the mind.", "duration": 60},
            {"id": 4, "name": "Breathe & Release", "description": "Place hands on chest, breathe in for 4 counts, out for 6 counts.", "duration": 60},
        ],
    },
    "Shoulder Pain": {
        "title": "Shoulder Pain Relief",
        "duration": "5 min",
        "icon": "🤚",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Shoulder Well", "description": "Press the midpoint of the shoulder muscle firmly with the opposite hand.", "duration": 30},
            {"id": 2, "name": "Shoulder Back Point", "description": "Press the point behind the shoulder joint to release frozen shoulder.", "duration": 30},
            {"id": 3, "name": "Arm Circles", "description": "Gently circle both arms forward and backward to loosen the joint.", "duration": 30},
            {"id": 4, "name": "Neck Tilt Release", "description": "Tilt your head toward each shoulder slowly to stretch the neck and shoulder.", "duration": 30},
        ],
    },
    "Better Sleep": {
        "title": "Better Sleep",
        "duration": "8 min",
        "icon": "❤️",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Yin Tang Point", "description": "Gently press the point between your eyebrows and breathe slowly.", "duration": 60},
            {"id": 2, "name": "Behind Ear Point", "description": "Press the hollow point behind the ear lobe on both sides.", "duration": 60},
            {"id": 3, "name": "Inner Wrist Point", "description": "Press the inside of your wrist gently to calm the nervous system.", "duration": 60},
            {"id": 4, "name": "Inner Ankle Point", "description": "Press the point on the inside of your ankle above the bone.", "duration": 60},
            {"id": 5, "name": "Full Body Relax", "description": "Lie flat, close your eyes, breathe deeply and let your body sink.", "duration": 120},
        ],
    },
    "Eye Strain": {
        "title": "Eye Strain Relief",
        "duration": "5 min",
        "icon": "👁️",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 2,
        "steps": [
            {"id": 1, "name": "Eye Socket Rim", "description": "Gently press around the bone of the eye socket in a slow circle.", "duration": 30},
            {"id": 2, "name": "Bridge of Nose", "description": "Pinch the bridge of your nose firmly where it meets the eyebrows.", "duration": 30},
            {"id": 3, "name": "Temple Press", "description": "Press both temples in a slow circular motion to ease eye tension.", "duration": 30},
            {"id": 4, "name": "Palm Cup", "description": "Rub palms together to warm them, then cup gently over closed eyes.", "duration": 30},
        ],
    },
    "Anxiety": {
        "title": "Anxiety Relief",
        "duration": "8 min",
        "icon": "🫀",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 2,
        "steps": [
            {"id": 1, "name": "Pericardium Point", "description": "Press the inside of your wrist, two finger-widths from the crease.", "duration": 60},
            {"id": 2, "name": "Third Eye Calm", "description": "Gently press between your eyebrows and take slow deep breaths.", "duration": 60},
            {"id": 3, "name": "Chest Release", "description": "Place a fist on your sternum and apply gentle circular pressure.", "duration": 60},
            {"id": 4, "name": "Grounding Breath", "description": "Breathe in for 4 counts, hold 4, out for 8. Repeat 5 times.", "duration": 60},
        ],
    },
    "Sleep": {
        "title": "Better Sleep",
        "duration": "8 min",
        "icon": "❤️",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 1,
        "steps": [
            {"id": 1, "name": "Yin Tang Point", "description": "Gently press the point between your eyebrows and breathe slowly.", "duration": 60},
            {"id": 2, "name": "Behind Ear Point", "description": "Press the hollow point behind the ear lobe on both sides.", "duration": 60},
            {"id": 3, "name": "Inner Wrist Point", "description": "Press the inside of your wrist gently to calm the nervous system.", "duration": 60},
            {"id": 4, "name": "Full Body Relax", "description": "Lie flat, close your eyes, breathe deeply and let your body sink.", "duration": 120},
        ],
    },
    "Joint Pain": {
        "title": "Joint Pain Relief",
        "duration": "6 min",
        "icon": "👣",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Knee Eye Points", "description": "Press the soft points on either side of the kneecap firmly.", "duration": 30},
            {"id": 2, "name": "Ankle Circles", "description": "Gently rotate each ankle clockwise and anticlockwise to loosen the joint.", "duration": 30},
            {"id": 3, "name": "Foot Arch Press", "description": "Press firmly along the arch of your foot to relieve joint tension.", "duration": 30},
            {"id": 4, "name": "Calf Release", "description": "Press and release the calf muscle with both hands to improve circulation.", "duration": 30},
        ],
    },
}
