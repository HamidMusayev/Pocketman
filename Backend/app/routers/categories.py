from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.schemas.category import (
    CategoryBudgetSummary,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
)
from app.security import require_auth
from app.services.categories import budget_summary, category_in_use
from app.services.periods import PERIODS

router = APIRouter(
    prefix="/api/categories", tags=["categories"], dependencies=[Depends(require_auth)]
)


@router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return db.query(Category).order_by(Category.id).all()


@router.get("/budget-summary", response_model=CategoryBudgetSummary)
def get_budget_summary(
    period: str = Query("monthly", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    if period not in PERIODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid period")
    return budget_summary(db, period, year, month)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)) -> Category:
    if db.query(Category).filter(Category.name == body.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    category = Category(name=body.name, type=body.type, icon=body.icon, budget=body.budget)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)
) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="name cannot be empty")
        existing = db.query(Category).filter(Category.name == name, Category.id != category_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
        category.name = name
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
def delete_category(category_id: int, db: Session = Depends(get_db)) -> None:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if category_in_use(db, category_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is used by transactions or recurring rules and cannot be removed",
        )
    db.delete(category)
    db.commit()
