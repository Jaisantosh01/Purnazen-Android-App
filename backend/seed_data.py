"""Session catalog seed content.

Ported from the (now removed) frontend mock data so the players can run from
API content:
- mobile-users/src/data/yogaSessionData.js  -> WELLNESS_SESSIONS
- mobile-users/src/data/reliefSessionData.js -> RELIEF_SESSIONS

Keys match the sessionKey/reliefKey values the screens navigate with.
"""

_RELIEF_VIDEO = "https://res.cloudinary.com/dcngh7dkt/video/upload/Wrist_Pain_n2i3wq.mp4"

WELLNESS_SESSIONS = {
    "YogaSession": {
        "title": "Morning Yoga",
        "duration": "20 min",
        "icon": "lightning-bolt",
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
        "icon": "brain",
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
}

RELIEF_SESSIONS = {
    "Headache": {
        "title": "Headache Relief",
        "duration": "5 min",
        "icon": "brain",
        "videoUrl": _RELIEF_VIDEO,
        "totalCycles": 3,
        "steps": [
            {"id": 1, "name": "Temple Points", "description": "Apply gentle pressure on both temples in a slow circular motion.", "duration": 30},
            {"id": 2, "name": "Third Eye Point", "description": "Press the point between your eyebrows firmly for relief.", "duration": 30},
        ],
    },
}

VIDEO_GROUPS = [
    {
        "key": "QuickRelief",
        "title": "Quick Relief",
        "description": "Fast acupressure routines for immediate symptom relief.",
        "icon": "lightning-bolt",
        "sort_order": 1,
    },
    {
        "key": "Wellness",
        "title": "Wellness & Prevention",
        "description": "Long-term wellness routines for balance and prevention.",
        "icon": "brain",
        "sort_order": 2,
    }
]

VIDEOS = [
    {
        "group_title": "Quick Relief",
        "title": "Headache Relief",
        "description": "5-minute routine for tension headaches.",
        "duration": 300,
        "icon": "brain",
        "video_url": "Ankle_Pain/AnklePain.mp4",
        "sort_order": 1,
    },
    {
        "group_title": "Wellness & Prevention",
        "title": "Morning Yoga",
        "description": "Start your day with gentle movement.",
        "duration": 1200,
        "icon": "lightning-bolt",
        "video_url": "Ankle_Pain/AnklePain.mp4",
        "sort_order": 1,
    }
]

CHAT_FLOW = [
    # HEADACHE FLOW
    {
        "question": "How severe is your headache? (1-10)",
        "is_start": True,
        "options": [
            {"text": "Mild (1-3)", "next_question": "Where is pain located"},
            {"text": "Moderate (4-6)", "next_question": "Where is pain located"},
            {"text": "Severe (7-10)", "next_question": "Where is pain located"},
        ]
    },
    {
        "question": "Where is pain located",
        "is_start": False,
        "options": [
            {"text": "Forehead", "next_question": "How long have you had it ?"},
            {"text": "Temples", "next_question": "How long have you had it ?"},
            {"text": "Back Of head", "next_question": "How long have you had it ?"},
            {"text": "full Head", "next_question": "How long have you had it ?"},
        ]
    },
    {
        "question": "How long have you had it ?",
        "is_start": False,
        "options": [
            {"text": "Just started", "video_group_key": "QuickRelief"},
            {"text": "Few hours", "video_group_key": "QuickRelief"},
            {"text": "1-2 days", "video_group_key": "QuickRelief"},
            {"text": "More than 2 days", "video_group_key": "QuickRelief"},
        ]
    },
    
    # NECK PAIN FLOW
    {
        "question": "How severe is your neck pain? (1-10)",
        "is_start": True,
        "options": [
            {"text": "Mild (1-3)", "next_question": "Where is the stiffness located?"},
            {"text": "Moderate (4-6)", "next_question": "Where is the stiffness located?"},
            {"text": "Severe (7-10)", "next_question": "Where is the stiffness located?"},
        ]
    },
    {
        "question": "Where is the stiffness located?",
        "is_start": False,
        "options": [
            {"text": "Upper neck", "next_question": "How long has it been bothering you?"},
            {"text": "Lower neck", "next_question": "How long has it been bothering you?"},
            {"text": "Side of neck", "next_question": "How long has it been bothering you?"},
            {"text": "Shoulders", "next_question": "How long has it been bothering you?"},
        ]
    },
    {
        "question": "How long has it been bothering you?",
        "is_start": False,
        "options": [
            {"text": "Just started", "video_group_key": "QuickRelief"},
            {"text": "Few hours", "video_group_key": "QuickRelief"},
            {"text": "1-2 days", "video_group_key": "QuickRelief"},
            {"text": "More than 2 days", "video_group_key": "QuickRelief"},
        ]
    }
]

QUICK_RELIEFS = [
    {
        "name": "Headache",
        "slug": "headache",
        "title": "Headache",
        "subtitle": "Tension & migraine relief",
        "chat_question": "How severe is your headache? (1-10)",
        "icon_name": "brain",
        "background_color": "#E8F5E9",
        "text_color": "#2E7D32",
        "sort_order": 1
    },
    {
        "name": "Neck Pain",
        "slug": "neck-pain",
        "title": "Neck Pain",
        "subtitle": "stiffness & pain relief",
        "chat_question": "How severe is your neck pain? (1-10)",
        "icon_name": "lightning-bolt",
        "background_color": "#FFF3E0",
        "text_color": "#EF6C00",
        "sort_order": 2
    }
]
