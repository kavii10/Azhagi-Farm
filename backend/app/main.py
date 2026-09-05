from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import customers, milk_entries, bills, payments, app_settings, dashboard

app = FastAPI(
    title="Azhagi Farm API",
    description="Milk Customer Management Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(milk_entries.router, prefix="/api/milk-entries", tags=["Milk Entries"])
app.include_router(bills.router, prefix="/api/bills", tags=["Monthly Bills"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(app_settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/health")
def health():
    return {"status": "ok", "app": "Azhagi Farm"}
