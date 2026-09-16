"""Seed the database with realistic sample data.

Creates ~10 helpdesk employees and ~500 tickets covering every meaningful
combination the queue/filter logic needs to be exercised against:
overdue/not-overdue, urgent/high/normal, assigned/unassigned, and every
status - so pagination and queue ordering can be demonstrated against a
dataset that actually looks like a busy helpdesk.

Usage:
    python -m app.seed
    (or, inside Docker: docker compose exec backend python -m app.seed)
"""

from __future__ import annotations

import random
from datetime import timedelta

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.ticket import Priority, Status, Ticket
from app.models.user import User
from app.utils.datetime import utc_now

EMPLOYEES = [
    "Priya Patel",
    "Rahul Verma",
    "Amit Sharma",
    "Neha Gupta",
    "Vikram Singh",
    "Anjali Mehta",
    "Rohan Kapoor",
    "Sneha Reddy",
    "Arjun Nair",
    "Kavya Iyer",
]

CUSTOMERS = [
    "Amit Sharma",
    "Neha Gupta",
    "Rahul Verma",
    "Sanjay Malhotra",
    "Pooja Desai",
    "Karan Chopra",
    "Divya Rao",
    "Aditya Kumar",
    "Meera Joshi",
    "Vivek Bansal",
    "Ishaan Bhatt",
    "Tara Menon",
    "Global Traders Pvt Ltd",
    "Skyline Logistics",
    "BlueOcean Retail",
    "North Star Consulting",
]

TICKET_TEMPLATES = [
    ("Laptop won't boot", "Laptop is not starting; urgent, before a client demo."),
    ("VPN is not working", "Cannot connect to the office VPN from home."),
    ("Can I get a bigger monitor?", "Requesting a second/larger monitor for the desk."),
    ("Please install software X", "Need the latest version of the design suite installed."),
    ("Email not syncing", "Outlook stopped syncing new messages since this morning."),
    ("Password reset needed", "Locked out of the company portal after too many attempts."),
    ("Printer offline", "The 3rd floor printer shows offline for everyone."),
    ("Wi-Fi keeps dropping", "Conference room Wi-Fi disconnects every few minutes."),
    ("New employee laptop setup", "Onboarding laptop needs to be imaged and configured."),
    ("Slow computer performance", "Workstation has become very slow over the last week."),
    ("Access request for shared drive", "Need read/write access to the finance shared drive."),
    ("Monitor flickering", "External monitor flickers intermittently."),
    ("Software license expired", "Getting a license-expired popup in the CAD tool."),
    ("Cannot join video call", "Camera/mic not detected in the meeting app."),
    ("Phone system issue", "Desk phone has no dial tone."),
]

STATUS_WEIGHTS = [
    (Status.OPEN, 0.45),
    (Status.IN_PROGRESS, 0.25),
    (Status.RESOLVED, 0.15),
    (Status.CLOSED, 0.15),
]


def _weighted_choice(weighted: list[tuple[Status, float]]) -> Status:
    r = random.random()
    cumulative = 0.0
    for value, weight in weighted:
        cumulative += weight
        if r <= cumulative:
            return value
    return weighted[-1][0]


def seed(total_tickets: int = 500) -> None:
    settings = get_settings()
    now = utc_now()
    db = SessionLocal()

    try:
        print("Clearing existing data...")
        db.query(Ticket).delete()
        db.query(User).delete()
        db.commit()

        print(f"Creating {len(EMPLOYEES)} helpdesk employees...")
        users = []
        for name in EMPLOYEES:
            email = name.lower().replace(" ", ".") + "@helpdesk.example.com"
            user = User(name=name, email=email, password_hash=hash_password("Project"))
            db.add(user)
            users.append(user)
        db.flush()

        print(f"Creating {total_tickets} tickets...")

        # Explicitly guarantee every combination called out in the spec
        # exists at least once, before filling the rest randomly.
        guaranteed_specs = [
            # (priority, overdue?, assigned?, status)
            (Priority.URGENT, True, True, Status.OPEN),
            (Priority.URGENT, True, False, Status.IN_PROGRESS),
            (Priority.HIGH, True, True, Status.OPEN),
            (Priority.HIGH, True, False, Status.IN_PROGRESS),
            (Priority.NORMAL, True, True, Status.OPEN),
            (Priority.NORMAL, True, False, Status.OPEN),
            (Priority.URGENT, False, True, Status.OPEN),
            (Priority.URGENT, False, False, Status.OPEN),
            (Priority.HIGH, False, True, Status.OPEN),
            (Priority.HIGH, False, False, Status.IN_PROGRESS),
            (Priority.NORMAL, False, True, Status.IN_PROGRESS),
            (Priority.NORMAL, False, False, Status.OPEN),
            (Priority.URGENT, False, True, Status.RESOLVED),
            (Priority.NORMAL, False, False, Status.CLOSED),
        ]

        tickets_created = 0

        def build_ticket(
            priority: Priority, overdue: bool, assigned: bool, ticket_status: Status
        ) -> Ticket:
            template_title, template_desc = random.choice(TICKET_TEMPLATES)
            customer = random.choice(CUSTOMERS)

            sla_hours = {
                Priority.URGENT: settings.urgent_sla_hours,
                Priority.HIGH: settings.high_sla_hours,
                Priority.NORMAL: settings.normal_sla_hours,
            }[priority]

            if overdue:
                # created far enough in the past that due_at is already behind "now"
                overdue_by = timedelta(minutes=random.randint(5, 3 * 24 * 60))
                created_at = now - timedelta(hours=sla_hours) - overdue_by
            else:
                # created recently enough that due_at is still ahead of "now"
                remaining = (
                    timedelta(minutes=random.randint(5, sla_hours * 60 - 5))
                    if sla_hours > 1
                    else timedelta(minutes=random.randint(1, 30))
                )
                created_at = now - (timedelta(hours=sla_hours) - remaining)

            due_at = created_at + timedelta(hours=sla_hours)

            assignee = random.choice(users) if assigned else None

            return Ticket(
                customer_name=customer,
                customer_email=f"{customer.lower().replace(' ', '.').replace(',', '')}@example.com",
                title=template_title,
                description=template_desc,
                priority=priority,
                status=ticket_status,
                created_at=created_at,
                due_at=due_at,
                assigned_to=assignee.id if assignee else None,
            )

        for priority, overdue, assigned, ticket_status in guaranteed_specs:
            db.add(build_ticket(priority, overdue, assigned, ticket_status))
            tickets_created += 1

        while tickets_created < total_tickets:
            priority = random.choice([Priority.URGENT, Priority.HIGH, Priority.NORMAL])
            overdue = random.random() < 0.15
            assigned = random.random() < 0.6
            ticket_status = _weighted_choice(STATUS_WEIGHTS)

            # A resolved/closed ticket should not itself be forced overdue;
            # let created_at/due_at be in the past naturally instead.
            if ticket_status in (Status.RESOLVED, Status.CLOSED):
                overdue = False

            db.add(build_ticket(priority, overdue, assigned, ticket_status))
            tickets_created += 1

        db.commit()
        print(f"Done. Created {len(users)} users and {tickets_created} tickets.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
