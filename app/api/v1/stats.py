from fastapi import APIRouter
from sqlalchemy import select, func
from app.db import get_session
from app.models.orm_models import Inspection, DefectType, InspectionDefect, WorkerAudit

router = APIRouter()


@router.get("/")
def get_stats():
    session = get_session()
    try:
        total = session.execute(select(func.count()).select_from(Inspection)).scalar() or 0
        passes = session.execute(
            select(func.count()).select_from(Inspection).where(Inspection.status == 'pass')
        ).scalar() or 0
        fails = session.execute(
            select(func.count()).select_from(Inspection).where(Inspection.status == 'fail')
        ).scalar() or 0
        pending = session.execute(
            select(func.count()).select_from(Inspection).where(Inspection.status == 'pending')
        ).scalar() or 0
        in_review = session.execute(
            select(func.count()).select_from(Inspection).where(Inspection.status == 'in_review')
        ).scalar() or 0

        pass_rate = round(passes / total * 100, 1) if total > 0 else 0
        fail_rate = round(fails / total * 100, 1) if total > 0 else 0

        avg_defects = session.execute(
            select(func.avg(Inspection.defect_count)).select_from(Inspection)
        ).scalar()
        avg_defects = round(float(avg_defects), 2) if avg_defects else 0

        # Top 5 defect types
        top_defects_rows = session.execute(
            select(DefectType.name, DefectType.severity, func.sum(InspectionDefect.quantity).label('total'))
            .join(InspectionDefect, InspectionDefect.defect_type_id == DefectType.id)
            .group_by(DefectType.id, DefectType.name, DefectType.severity)
            .order_by(func.sum(InspectionDefect.quantity).desc())
            .limit(5)
        ).all()
        top_defects = [{"name": r.name, "severity": r.severity, "total": int(r.total)}
                       for r in top_defects_rows]

        # Last 10 inspections for activity feed
        recent_rows = session.execute(
            select(Inspection).order_by(Inspection.created_at.desc()).limit(10)
        ).scalars().all()
        recent = [
            {
                "id": r.id,
                "batch_id": r.batch_id,
                "status": r.status,
                "defect_count": r.defect_count,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent_rows
        ]

        # Daily pass/fail for last 30 days (simplified counts)
        from sqlalchemy import cast, Date
        from datetime import date, timedelta
        daily_rows = session.execute(
            select(
                cast(Inspection.created_at, Date).label('day'),
                Inspection.status,
                func.count().label('cnt')
            )
            .group_by(cast(Inspection.created_at, Date), Inspection.status)
            .order_by(cast(Inspection.created_at, Date))
        ).all()
        trend = {}
        for row in daily_rows:
            day = str(row.day)
            if day not in trend:
                trend[day] = {"day": day, "pass": 0, "fail": 0, "pending": 0}
            if row.status == 'pass':
                trend[day]['pass'] = row.cnt
            elif row.status == 'fail':
                trend[day]['fail'] = row.cnt
            else:
                trend[day]['pending'] += row.cnt
        trend_list = sorted(trend.values(), key=lambda x: x['day'])[-30:]

        return {
            "total_inspections": total,
            "pass": passes,
            "fail": fails,
            "pending": pending,
            "in_review": in_review,
            "pass_rate": pass_rate,
            "fail_rate": fail_rate,
            "avg_defects_per_inspection": avg_defects,
            "top_defects": top_defects,
            "recent_activity": recent,
            "trend": trend_list,
        }
    finally:
        session.close()
