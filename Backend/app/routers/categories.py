from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.user import User
from app.ownership import get_owned, owned_query
from app.schemas.category import (
    CategoryBudgetSummary,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
)
from app.security import get_current_user
from app.services.categories import budget_summary, category_in_use
from app.services.periods import PERIODS

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _name_taken(db: Session, user_id: int, name: str, exclude_id: int | None = None) -> bool:
    q = owned_query(db, Category, user_id).filter(Category.name == name)
    if exclude_id is not None:
        q = q.filter(Category.id != exclude_id)
    return q.first() is not None


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Category]:
    return owned_query(db, Category, user.id).order_by(Category.id).all()


@router.get("/budget-summary", response_model=CategoryBudgetSummary)
def get_budget_summary(
    period: str = Query("monthly", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if period not in PERIODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid period")
    return budget_summary(db, user.id, period, year, month)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Category:
    if _name_taken(db, user.id, body.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    category = Category(
        user_id=user.id, name=body.name, type=body.type, icon=body.icon, budget=body.budget
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Category:
    category = get_owned(db, Category, category_id, user.id, "Category")
    if body.name is not None:
        if _name_taken(db, user.id, body.name, exclude_id=category_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
        category.name = body.name
    if body.icon is not None:
        category.icon = body.icon
    if body.budget is not None:
        if body.budget < 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="budget cannot be negative")
        category.budget = body.budget
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    category = get_owned(db, Category, category_id, user.id, "Category")
    if category_in_use(db, category_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is used by transactions or recurring rules and cannot be removed",
        )
    db.delete(category)
    db.commit()
