"""TCM-based recommendation engine.

Generates personalised wellness recommendations from a scan result.
The input may be a ScanResult ORM object or any object that exposes
the relevant score attributes (use ``types.SimpleNamespace`` from the
pipeline for the latter).

Each returned dict has the keys expected by ScanRecommendationRepository:
    recommendation_type, priority, title, description, routine_key, tip_category
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Maximum recommendations to return (take highest priority first)
_MAX_RECS = 8


def _get(obj: Any, attr: str, default=None):
    """Safely retrieve a float attribute from the result object."""
    val = getattr(obj, attr, None)
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _get_str(obj: Any, attr: str, default: str = "") -> str:
    val = getattr(obj, attr, None)
    if val is None:
        return default
    return str(val).lower().strip()


def generate(scan_result: Any) -> list[dict]:
    """Generate up to _MAX_RECS recommendations sorted by priority (ascending).

    Priority 0 = highest importance.
    """
    recs: list[dict] = []

    hydration    = _get(scan_result, "hydration_score")
    inflammation = _get(scan_result, "inflammation_score")
    dark_circle  = _get(scan_result, "dark_circle_score")
    glow         = _get(scan_result, "glow_score")
    oiliness     = _get(scan_result, "oiliness_score")
    wrinkle      = _get(scan_result, "wrinkle_score")
    pigmentation = _get(scan_result, "pigmentation_score")
    elasticity   = _get(scan_result, "elasticity_score")
    toxin        = _get(scan_result, "toxin_indicator")
    muscle_tone  = _get(scan_result, "muscle_tone_score")
    pore         = _get(scan_result, "pore_score")
    overall      = _get(scan_result, "overall_wellness_score")

    tongue_coat_color  = _get_str(scan_result, "tongue_coat_color")
    tongue_moisture    = _get_str(scan_result, "tongue_moisture")
    tongue_body_color  = _get_str(scan_result, "tongue_body_color")

    def hi(v, t):
        return v is not None and v > t

    def lo(v, t):
        return v is not None and v < t

    # =======================================================================
    # Combination / pattern rules (added first → priority 0, so co-occurring
    # patterns surface ahead of single-metric tips). These read more like a TCM
    # practitioner's holistic assessment than isolated thresholds.
    # =======================================================================

    # Dehydrated-oily "combination skin" → Yin deficiency with Damp-heat
    if lo(hydration, 45) and hi(oiliness, 60):
        recs.append({
            "recommendation_type": "routine",
            "priority": 0,
            "title": "Balance Combination Skin",
            "description": (
                "Low hydration with excess oil points to Yin deficiency alongside "
                "Damp-heat — your skin overproduces oil to compensate for dryness. "
                "Hydrate with light, water-based care and use Gua Sha to move stagnation "
                "rather than stripping the skin."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "hydration",
        })

    # Congested / breakout-prone → Damp-heat accumulation
    if hi(oiliness, 60) and hi(pore, 55) and hi(inflammation, 50):
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 0,
            "title": "Clarify Congested Skin",
            "description": (
                "Oiliness, enlarged pores and redness together signal Damp-heat. "
                "Reduce dairy, fried and sugary foods, favour cooling bitter greens, "
                "and cleanse gently twice daily to calm congestion."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "nutrition",
        })

    # Fatigue pattern → Qi & Blood depletion
    if hi(dark_circle, 55) and lo(glow, 55):
        recs.append({
            "recommendation_type": "routine",
            "priority": 1,
            "title": "Restore Radiance",
            "description": (
                "Pronounced dark circles with a low glow score reflect Qi and Blood "
                "depletion — often from poor sleep or overwork. Prioritise rest and "
                "this circulation-boosting routine to bring back radiance."
            ),
            "routine_key": "NightRepair",
            "tip_category": "sleep",
        })

    # Ageing pattern → Yin & Blood deficiency
    if hi(wrinkle, 55) and lo(elasticity, 50):
        recs.append({
            "recommendation_type": "routine",
            "priority": 1,
            "title": "Firm & Renew",
            "description": (
                "Fine lines with reduced elasticity indicate Yin and Blood deficiency. "
                "Support collagen with bone broth, fish and vitamin-C foods, and lift "
                "with daily facial acupressure."
            ),
            "routine_key": "FacialAcupressure",
            "tip_category": "nutrition",
        })

    # Post-inflammatory pigmentation → Heat with Blood stasis
    if hi(inflammation, 55) and hi(pigmentation, 55):
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 1,
            "title": "Calm, Then Even Tone",
            "description": (
                "Redness together with uneven tone suggests Heat in the Blood leading "
                "to stasis (post-inflammatory marks). Calm first with cooling foods, "
                "then even tone with gentle Gua Sha once the redness settles."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Rule 4 (priority 0): Low glow → Qi/Blood stagnation
    # -----------------------------------------------------------------------
    if glow is not None and glow < 50:
        recs.append({
            "recommendation_type": "routine",
            "priority": 0,
            "title": "Morning Glow Routine",
            "description": (
                "Your glow score indicates Qi and Blood stagnation. "
                "Begin your day with this energising acupressure sequence to "
                "restore circulation and natural radiance."
            ),
            "routine_key": "MorningGlow",
            "tip_category": None,
        })

    # -----------------------------------------------------------------------
    # Rule 1 (priority 1): Low hydration → Yin deficiency
    # -----------------------------------------------------------------------
    if hydration is not None and hydration < 40:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 1,
            "title": "Boost Hydration",
            "description": (
                "Low skin hydration suggests Yin deficiency. "
                "Drink at least 8 glasses of water daily and include "
                "moisturising Yin-nourishing foods such as cucumber, pear, "
                "and sesame in your diet."
            ),
            "routine_key": "NightRepair",
            "tip_category": "hydration",
        })

    # -----------------------------------------------------------------------
    # Rule 6 (priority 2): High wrinkles → Yin/Blood deficiency
    # -----------------------------------------------------------------------
    if wrinkle is not None and wrinkle > 60:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 2,
            "title": "Antioxidant Foods",
            "description": (
                "Visible fine lines point to Yin and Blood deficiency. "
                "Increase your intake of antioxidant-rich foods: berries, "
                "leafy greens, and colourful vegetables to support skin renewal."
            ),
            "routine_key": "NightRepair",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Rule 7 (priority 3): High pigmentation → Blood stagnation
    # -----------------------------------------------------------------------
    if pigmentation is not None and pigmentation > 60:
        recs.append({
            "recommendation_type": "routine",
            "priority": 3,
            "title": "Gua Sha Flow Routine",
            "description": (
                "Uneven skin tone reflects Blood stagnation. "
                "Gua Sha stimulates microcirculation to even out pigmentation "
                "and restore a luminous complexion."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": None,
        })

    # -----------------------------------------------------------------------
    # Rule 3 (priority 4): High dark circles → Qi deficiency
    # -----------------------------------------------------------------------
    if dark_circle is not None and dark_circle > 60:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 4,
            "title": "Prioritise Sleep",
            "description": (
                "Pronounced dark circles are a classic sign of Qi deficiency. "
                "Aim for 7–9 hours of quality sleep and consider a relaxing "
                "night-time ritual to support your body's overnight repair."
            ),
            "routine_key": "NightRepair",
            "tip_category": "sleep",
        })

    # -----------------------------------------------------------------------
    # Rule 2 (priority 5): High inflammation → Heat in blood
    # -----------------------------------------------------------------------
    if inflammation is not None and inflammation > 60:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 5,
            "title": "Reduce Refined Sugars",
            "description": (
                "Facial redness and inflammation indicate Heat in the Blood. "
                "Minimise refined sugars, alcohol, and spicy foods. "
                "Cooling foods such as watermelon, cucumber, and mint can help."
            ),
            "routine_key": "FacialAcupressure",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Rule 5 (priority 6): High oiliness → Dampness-heat
    # -----------------------------------------------------------------------
    if oiliness is not None and oiliness > 70:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 6,
            "title": "Reduce Dairy",
            "description": (
                "Excess oiliness is linked to Dampness-heat in TCM. "
                "Reducing dairy and greasy foods, along with regular "
                "Gua Sha, can help balance sebum production."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Rule 8 (priority 7): Low elasticity → Qi/Blood deficiency
    # -----------------------------------------------------------------------
    if elasticity is not None and elasticity < 40:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 7,
            "title": "Collagen-Rich Foods",
            "description": (
                "Reduced skin elasticity points to Qi and Blood deficiency. "
                "Incorporate collagen-boosting foods — bone broth, fish, eggs, "
                "and vitamin C-rich fruits — to support skin structure."
            ),
            "routine_key": "FacialAcupressure",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Rule 9 (priority 8): High toxin indicator → Dampness toxins
    # -----------------------------------------------------------------------
    if toxin is not None and toxin > 60:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 8,
            "title": "Detox Water",
            "description": (
                "Elevated toxin indicators suggest Dampness accumulation. "
                "Start each morning with warm lemon water and stay well "
                "hydrated throughout the day to support lymphatic drainage."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "detox",
        })

    # -----------------------------------------------------------------------
    # Rule 10 (priority 9): Low muscle tone → Qi deficiency
    # -----------------------------------------------------------------------
    if muscle_tone is not None and muscle_tone < 40:
        recs.append({
            "recommendation_type": "routine",
            "priority": 9,
            "title": "Facial Acupressure Routine",
            "description": (
                "Facial asymmetry and reduced muscle tone reflect Qi deficiency. "
                "This targeted acupressure routine strengthens facial muscles "
                "and restores energetic balance."
            ),
            "routine_key": "FacialAcupressure",
            "tip_category": None,
        })

    # -----------------------------------------------------------------------
    # Rule 15 (priority 10): High pore score → Dampness
    # -----------------------------------------------------------------------
    if pore is not None and pore > 60:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 10,
            "title": "Reduce Sugar",
            "description": (
                "Enlarged pores indicate Dampness accumulation. "
                "Cutting refined sugars and processed foods helps reduce "
                "excess sebum and tighten pores over time."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "nutrition",
        })

    # -----------------------------------------------------------------------
    # Tongue rules
    # -----------------------------------------------------------------------

    # Rule 11: Yellow tongue coat → Damp-heat
    if tongue_coat_color == "yellow":
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 11,
            "title": "Cooling Foods",
            "description": (
                "A yellow tongue coat indicates Damp-heat. "
                "Include cooling foods such as bitter melon, chrysanthemum tea, "
                "and mung beans in your diet to clear internal heat."
            ),
            "routine_key": "GuaShaFlow",
            "tip_category": "nutrition",
        })

    # Rule 12: Dry tongue → Yin deficiency
    if tongue_moisture == "dry":
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 12,
            "title": "Yin-Nourishing Foods",
            "description": (
                "Dry tongue moisture points to Yin deficiency. "
                "Nourish Yin with foods like black sesame, tremella mushroom, "
                "lotus root, and plenty of water."
            ),
            "routine_key": "NightRepair",
            "tip_category": "nutrition",
        })

    # Rule 13: Pale tongue body → Qi/Blood deficiency
    if tongue_body_color == "pale":
        recs.append({
            "recommendation_type": "routine",
            "priority": 13,
            "title": "Morning Glow Routine",
            "description": (
                "A pale tongue body indicates Qi and Blood deficiency. "
                "Energise your mornings with this glow routine and include "
                "iron-rich foods such as leafy greens and legumes."
            ),
            "routine_key": "MorningGlow",
            "tip_category": None,
        })

    # Rule 14: Dark red tongue body → Heat in blood
    if tongue_body_color == "dark_red":
        recs.append({
            "recommendation_type": "routine",
            "priority": 14,
            "title": "Facial Acupressure Routine",
            "description": (
                "A dark red tongue body indicates Heat in the Blood. "
                "This cooling facial acupressure routine helps disperse "
                "excess heat and calm inflammation."
            ),
            "routine_key": "FacialAcupressure",
            "tip_category": None,
        })

    # -----------------------------------------------------------------------
    # Bonus Rule 16: Excellent vitality celebration
    # -----------------------------------------------------------------------
    if (
        elasticity is not None and elasticity >= 70
        and glow is not None and glow >= 70
    ):
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 15,
            "title": "Excellent Skin Vitality",
            "description": (
                "Your skin shows excellent vitality — keep up your wellness "
                "routine! Consistency is the key to lasting radiance."
            ),
            "routine_key": None,
            "tip_category": "celebration",
        })

    # -----------------------------------------------------------------------
    # Bonus Rule 17: Very low overall wellness score
    # -----------------------------------------------------------------------
    if overall is not None and overall < 40:
        recs.append({
            "recommendation_type": "wellness_tip",
            "priority": 16,
            "title": "Schedule a Wellness Consultation",
            "description": (
                "Your overall wellness score is quite low. "
                "We recommend scheduling a personalised consultation with a "
                "Purnazen wellness practitioner for a comprehensive TCM assessment."
            ),
            "routine_key": None,
            "tip_category": "consultation",
        })

    # Sort by priority (ascending = highest priority first)
    recs.sort(key=lambda r: r["priority"])

    # Cap at _MAX_RECS
    return recs[:_MAX_RECS]
