from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, datetime

BatchType = Literal["morning", "evening", "both"]
EntryBatchType = Literal["morning", "evening"]
MilkStatus = Literal["delivered", "no_milk"]
BillStatusType = Literal["pending", "partial", "paid"]

class AppSettingsSchema(BaseModel):
    id: Optional[str] = None
    default_rate: float = 60.0
    farm_name: str = "Azhagi Farm"
    currency: str = "INR"
    owner_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    batch: BatchType
    default_quantity_litre: float = 1.0
    default_quantity_evening_litre: Optional[float] = None
    custom_rate: Optional[float] = None
    notes: Optional[str] = None
    active: bool = True

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    batch: Optional[BatchType] = None
    default_quantity_litre: Optional[float] = None
    default_quantity_evening_litre: Optional[float] = None
    custom_rate: Optional[float] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class CustomerResponse(CustomerCreate):
    id: str
    owner_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class MilkEntryUpsert(BaseModel):
    customer_id: str
    entry_date: date
    batch: EntryBatchType = "morning"
    quantity_litre: Optional[float] = None
    status: MilkStatus = "delivered"

class BulkNoMilkRequest(BaseModel):
    customer_id: str
    from_date: date
    to_date: date
    batch: Optional[EntryBatchType] = None

class MilkEntryResponse(BaseModel):
    id: str
    customer_id: str
    entry_date: date
    batch: EntryBatchType
    quantity_litre: Optional[float] = None
    status: MilkStatus
    owner_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PaymentCreate(BaseModel):
    bill_id: str
    customer_id: str
    amount: float
    payment_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None

class PaymentResponse(PaymentCreate):
    id: str
    owner_id: Optional[str] = None
    created_at: Optional[datetime] = None

class MonthlyBillResponse(BaseModel):
    id: str
    customer_id: str
    billing_year: int
    billing_month: int
    total_litres: float
    rate_per_litre: float
    total_amount: float
    paid_amount: float
    balance_amount: float
    status: BillStatusType
    is_finalized: bool
    customer: Optional[CustomerResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
