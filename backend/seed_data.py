"""Session catalog seed content.

Ported from the (now removed) frontend mock data so the players can run from
API content:
- mobile-users/src/data/yogaSessionData.js  -> WELLNESS_SESSIONS
- mobile-users/src/data/reliefSessionData.js -> RELIEF_SESSIONS

Keys match the sessionKey/reliefKey values the screens navigate with.
"""

# TODO: upload to Azure Blob Storage and replace with the blob name (e.g. "videos/Wrist_Pain.mp4")
_RELIEF_VIDEO = "https://res.cloudinary.com/dcngh7dkt/video/upload/Wrist_Pain_n2i3wq.mp4"

WELLNESS_SESSIONS_DATA = [
    {"title": "Morning Yoga", "duration": "20 min", "icon": "heart-pulse", "sort_order": 0, "video_group_title": "Quick Relief"},
    {"title": "Mindful Meditation", "duration": "15 min", "icon": "brain", "sort_order": 1, "video_group_title": "Wellness & Prevention"},
    {"title": "Box Breathing", "duration": "10 min", "icon": "heart", "sort_order": 2, "video_group_title": "Quick Relief"},
    {"title": "Morning Routine", "duration": "10 min", "icon": "flower", "sort_order": 3, "video_group_title": "Wellness & Prevention"},
    {"title": "Evening Wind Down", "duration": "15 min", "icon": "medical-bag", "sort_order": 4, "video_group_title": "Quick Relief"},
    {"title": "Full Body stretch", "duration": "10 min", "icon": "brain", "sort_order": 5, "video_group_title": "Wellness & Prevention"},
]

# WELLNESS_SESSIONS = {
#     "YogaSession": {
#         "title": "Morning Yoga",
#         "duration": "20 min",
#         "icon": "lightning-bolt",
#         "videoUrl": None,
#         "totalCycles": 2,
#         "steps": [
#             {"id": 1, "name": "Mountain Pose", "description": "Stand tall, feet together, arms at sides. Breathe deeply.", "duration": 60},
#             {"id": 2, "name": "Forward Fold", "description": "Hinge at hips, let head hang heavy toward the floor.", "duration": 45},
#             {"id": 3, "name": "Downward Dog", "description": "Press palms flat, lift hips up and back, forming an inverted V.", "duration": 60},
#             {"id": 4, "name": "Warrior I", "description": "Step one foot forward, bend front knee, raise arms overhead.", "duration": 45},
#             {"id": 5, "name": "Child's Pose", "description": "Kneel, sit back on heels, extend arms forward and rest forehead down.", "duration": 60},
#             {"id": 6, "name": "Savasana", "description": "Lie flat on your back, close eyes, and relax completely.", "duration": 90},
#         ],
#     },
#     "MeditationSession": {
#         "title": "Mindful Meditation",
#         "duration": "15 min",
#         "icon": "brain",
#         "videoUrl": None,
#         "totalCycles": 1,
#         "steps": [
#             {"id": 1, "name": "Settle In", "description": "Find a comfortable seated position. Close your eyes gently.", "duration": 60},
#             {"id": 2, "name": "Body Scan", "description": "Bring awareness from your feet upward, releasing tension at each point.", "duration": 120},
#             {"id": 3, "name": "Breath Awareness", "description": "Focus solely on the natural rhythm of your breath.", "duration": 180},
#             {"id": 4, "name": "Loving Kindness", "description": "Silently wish yourself and others health, happiness, and peace.", "duration": 120},
#             {"id": 5, "name": "Return & Open", "description": "Gently wiggle fingers and toes, then slowly open your eyes.", "duration": 60},
#         ],
#     },
# }

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
        "video_url": "Ankle_Pain/Ankle Pain.mp4",
        "sort_order": 1,
    },
    {
        "group_title": "Wellness & Prevention",
        "title": "Morning Yoga",
        "description": "Start your day with gentle movement.",
        "duration": 1200,
        "icon": "lightning-bolt",
        "video_url": "Ankle_Pain/Ankle Pain.mp4",
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
            {"text": "Just started", "video_group_key": "Quick Relief"},
            {"text": "Few hours", "video_group_key": "Quick Relief"},
            {"text": "1-2 days", "video_group_key": "Quick Relief"},
            {"text": "More than 2 days", "video_group_key": "Quick Relief"},
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
            {"text": "Just started", "video_group_key": "Quick Relief"},
            {"text": "Few hours", "video_group_key": "Quick Relief"},
            {"text": "1-2 days", "video_group_key": "Quick Relief"},
            {"text": "More than 2 days", "video_group_key": "Quick Relief"},
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

# No support contacts are seeded — the placeholder email/phone/WhatsApp don't
# exist yet. The Help & Support screen shows a "Coming soon" state while this is
# empty; real channels can be added later via the admin API (POST /support/contacts).
SUPPORT_CONTACTS = []

SUPPORT_FAQS = [
    {
        "question": "How do I book a consultation?",
        "answer": 'Go to the Consult tab, browse available doctors, tap on a doctor to view their profile, then tap "Book Appointment" to select a date, time, and visit type.',
        "sort_order": 1,
    },
    {
        "question": "How do I cancel or reschedule an appointment?",
        "answer": 'Go to Profile → Therapy History, find the appointment, and tap "Cancel" or "Reschedule." Cancellations made 24 hours before the appointment are fully refunded.',
        "sort_order": 2,
    },
    {
        "question": "What payment methods are accepted?",
        "answer": "We accept Credit/Debit Cards, UPI (Google Pay, PhonePe, Paytm), and major digital wallets. All transactions are secured with 256-bit encryption.",
        "sort_order": 3,
    },
    {
        "question": "Are the wellness sessions free?",
        "answer": "Yes! Yoga, Meditation, Breathing Exercises, and all wellness programs are free for all users. Premium members get access to exclusive programs and personalized plans.",
        "sort_order": 4,
    },
    {
        "question": "Is my health data secure?",
        "answer": "Absolutely. All your health data is encrypted and stored securely. We follow strict privacy guidelines and never share your personal data with third parties without your consent.",
        "sort_order": 5,
    },
]

AWARDS = [
    {
        "doctor_email": "sarah@example.com",
        "title": "Best Acupressure Practitioner",
        "issuer": "Global Wellness Society",
        "year": 2024,
        "description": "Recognized for excellence in acupressure techniques."
    },
    {
        "doctor_email": "sarah@example.com",
        "title": "Wellness Innovator Award",
        "issuer": "HealthTech Council",
        "year": 2025,
        "description": "For innovative approaches to holistic health."
    },
    {
        "doctor_email": "priya@example.com",
        "title": "Pain Management Excellence",
        "issuer": "Pain Relief Association",
        "year": 2023,
        "description": "Outstanding contributions to chronic pain management."
    }
]

DOCTOR_LEAVES = [
    {
        "doctor_email": "sarah@example.com",
        "leave_date": "2026-06-25",
        "slot_timing_id": None,
        "doctor_reason": "Personal day off",
        "admin_reason": None,
        "status": "pending",
    },
    {
        "doctor_email": "sarah@example.com",
        "leave_date": "2026-06-26",
        "slot_timing_id": None,
        "doctor_reason": "Medical appointment",
        "admin_reason": "Approved by admin",
        "status": "approved",
    },
    {
        "doctor_email": "rajesh@example.com",
        "leave_date": "2026-06-24",
        "slot_timing_id": None,
        "doctor_reason": "Family function",
        "admin_reason": None,
        "status": "pending",
    },
    {
        "doctor_email": "priya@example.com",
        "leave_date": "2026-06-27",
        "slot_timing_id": None,
        "doctor_reason": "Conference attendance",
        "admin_reason": "Approved for CME conference",
        "status": "approved",
    },
]

CLINICS = [
    {
        "doctor_email": "sarah@example.com",
        "name": "Sarah Acupressure Clinic",
        "address": "123 MG Road, Indiranagar",
        "city": "Bangalore",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "phone": "+91-9876543210",
        "is_primary": True,
    },
    {
        "doctor_email": "rajesh@example.com",
        "name": "Rajesh Wellness Center",
        "address": "456 Brigade Road, Koramangala",
        "city": "Bangalore",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "phone": "+91-9876543211",
        "is_primary": True,
    },
    {
        "doctor_email": "priya@example.com",
        "name": "Priya Pain Management Clinic",
        "address": "789 Church Street, MG Road",
        "city": "Bangalore",
        "latitude": 12.9756,
        "longitude": 77.6067,
        "phone": "+91-9876543212",
        "is_primary": True,
    },
    {
        "doctor_email": "priya@example.com",
        "name": "Priya Wellness Annex",
        "address": "321 JP Nagar, Phase 2",
        "city": "Bangalore",
        "latitude": 12.9063,
        "longitude": 77.5857,
        "phone": "+91-9876543213",
        "is_primary": False,
    },
]

DAYS_OF_WEEK = [
    {"day_number": 0, "day": "Sunday"},
    {"day_number": 1, "day": "Monday"},
    {"day_number": 2, "day": "Tuesday"},
    {"day_number": 3, "day": "Wednesday"},
    {"day_number": 4, "day": "Thursday"},
    {"day_number": 5, "day": "Friday"},
    {"day_number": 6, "day": "Saturday"},
]

# Generate 1-hour slots from 9am to 6pm for Mon-Sat
SLOT_TIMINGS = []
for day in DAYS_OF_WEEK:
    if day["day"] == "Sunday":
        continue
    
    # 9:00 to 18:00
    for hour in range(9, 18):
        SLOT_TIMINGS.append({
            "day_number": day["day_number"],
            "start_time": f"{hour:02d}:00:00",
            "end_time": f"{hour+1:02d}:00:00"
        })


# ---------------------------------------------------------------------------
# Subscription plans (catalog served to the Subscriptions screen)
# ---------------------------------------------------------------------------
SUBSCRIPTION_PLANS = [
    {
        "code": "free",
        "name": "Free",
        "price": 0,
        "currency": "INR",
        "period": "forever",
        "badge": None,
        "accent_color": None,          # null → neutral, theme-aware card
        "sort_order": 0,
        "features": [
            {"text": "3 wellness sessions/month", "included": True},
            {"text": "Basic yoga & meditation", "included": True},
            {"text": "Quick relief guides", "included": True},
            {"text": "Doctor consultations", "included": False},
            {"text": "Personalized health plan", "included": False},
            {"text": "Priority support", "included": False},
        ],
    },
    {
        "code": "premium",
        "name": "Premium",
        "price": 499,
        "currency": "INR",
        "period": "month",
        "badge": "Most Popular",
        "accent_color": "#1FA77A",
        "sort_order": 1,
        "features": [
            {"text": "Unlimited wellness sessions", "included": True},
            {"text": "All yoga & meditation programs", "included": True},
            {"text": "Quick relief guides", "included": True},
            {"text": "2 doctor consultations/month", "included": True},
            {"text": "Personalized health plan", "included": True},
            {"text": "Priority support", "included": False},
        ],
    },
    {
        "code": "pro",
        "name": "Pro",
        "price": 999,
        "currency": "INR",
        "period": "month",
        "badge": None,
        "accent_color": "#7C3AED",
        "sort_order": 2,
        "features": [
            {"text": "Unlimited wellness sessions", "included": True},
            {"text": "All yoga & meditation programs", "included": True},
            {"text": "Quick relief guides", "included": True},
            {"text": "Unlimited consultations", "included": True},
            {"text": "Personalized health plan", "included": True},
            {"text": "Priority 24/7 support", "included": True},
        ],
    },
]
