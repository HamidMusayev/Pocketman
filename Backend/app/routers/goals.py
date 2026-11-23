from datetime import date
from decimal import ROUND_UP

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.goal import Goal
from app.models.user import User
from app.money import CENT, MAX_AMOUNT, ZERO
from app.ownership import get_owned, owned_query
from app.schemas.goal import GoalContribution, GoalCreate, GoalResponse, GoalUpdate
from app.security import get_current_user

router = APIRouter(prefix="/api/goals", tags=["goals"])


def months_until(target: date, today: date) -> int:
    """Whole months left to save, counting the current month: a goal due later
    this month has 1 month left, one due next month has 2. 0 once it's past."""
    if target < today:
        return 0
    delta = relativedelta(target, today)
    return delta.years * 12 + delta.months + 1


def goal_response(goal: Goal, today: date | None = None) -> dict:
    today = today or date.today()
    saved = goal.saved_amount or ZERO
    remaining = max(goal.target_amount - saved, ZERO)
    pct = min(100, int(saved * 100 / goal.target_amount)) if goal.target_amount > 0 else 0
    months_left = monthly_needed = None
    if goal.target_date is not None:
        months_left = months_until(goal.target_date, today)
        if remaining > 0:
            # nothing left to spread the remainder over → it's all due now
            monthly_needed = (
                (remaining / months_left).quantize(CENT, rounding=ROUND_UP) if months_left else remaining
            )
        else:
            monthly_needed = ZERO
    return {
        "id": goal.id,
        "name": goal.name,
        "icon": goal.icon,
        "target_amount": goal.target_amount,
        "saved_amount": saved,
        "remaining": remaining,
        "pct": pct,
        "target_date": goal.target_date,
        "months_left": months_left,
        "monthly_needed": monthly_needed,
        "completed": remaining == 0,
    }


@router.get("", response_model=list[GoalResponse])
def list_goals(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    goals = owned_query(db, Goal, user.id).order_by(Goal.id).all()
    return [goal_response(g) for g in goals]


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    body: GoalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    goal = Goal(user_id=user.id, **body.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal_response(goal)


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    body: GoalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    goal = get_owned(db, Goal, goal_id, user.id, "Goal")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is None and field != "target_date":  # target_date can be cleared
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{field} cannot be null")
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal_response(goal)


@router.post("/{goal_id}/contribute", response_model=GoalResponse)
def contribute(
    goal_id: int,
    body: GoalContribution,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    goal = get_owned(db, Goal, goal_id, user.id, "Goal")
    new_saved = (goal.saved_amount or ZERO) + body.amount
    if new_saved < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot take out more than has been saved",
        )
    if new_saved >= MAX_AMOUNT:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="amount is too large")
    goal.saved_amount = new_saved
    db.commit()
    db.refresh(goal)
    return goal_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    goal = get_owned(db, Goal, goal_id, user.id, "Goal")
    db.delete(goal)
    db.commit()
