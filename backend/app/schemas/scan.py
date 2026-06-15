from pydantic import BaseModel
from typing import Optional


class ScanUploadResponse(BaseModel):
    scan_id: int
    status: str
    estimated_seconds: int = 10


class ScanResultData(BaseModel):
    hydrationScore: Optional[float] = None
    oilinessScore: Optional[float] = None
    wrinkleScore: Optional[float] = None
    pigmentationScore: Optional[float] = None
    darkCircleScore: Optional[float] = None
    poreScore: Optional[float] = None
    elasticityScore: Optional[float] = None
    muscleToneScore: Optional[float] = None
    inflammationScore: Optional[float] = None
    glowScore: Optional[float] = None
    toxinIndicator: Optional[float] = None
    overallWellnessScore: Optional[float] = None
    skinAgeEstimate: Optional[int] = None
    # Tongue fields
    tongueBodyColor: Optional[str] = None
    tongueCoatColor: Optional[str] = None
    tongueCoatThick: Optional[str] = None
    tongueMoisture: Optional[str] = None
    tongueShape: Optional[str] = None


class RecommendationData(BaseModel):
    id: int
    type: str
    priority: int
    title: str
    description: Optional[str] = None
    routineKey: Optional[str] = None
    videoUrl: Optional[str] = None
    tipCategory: Optional[str] = None


class ScanStatusResponse(BaseModel):
    scan_id: int
    status: str
    scan_type: str
    error_message: Optional[str] = None
    results: Optional[ScanResultData] = None
    recommendations: Optional[list[RecommendationData]] = None
    created_at: Optional[str] = None
    processing_completed_at: Optional[str] = None


class ScanHistoryItem(BaseModel):
    id: int
    scanType: str
    status: str
    glowScore: Optional[float] = None
    overallWellnessScore: Optional[float] = None
    imageUrl: Optional[str] = None
    createdAt: Optional[str] = None
