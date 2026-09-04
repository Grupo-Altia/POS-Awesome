# Copyright (c) 2026, Youssef Restom / Domina Software and contributors
# For license information, please see license.txt

"""Setup inicial y aprovisionamiento para el Punto de Venta (POS Awesome).

Configura de forma idempotente:
1. Cliente genérico por defecto (Clientes Varios).
2. Mapeo de cuentas contables para modos de pago venezolanos.
3. Parámetros del Perfil POS (GIO).
4. Usuario y PIN de cajero para terminal compartido.
5. Catálogo demo de artículos retail (alimentos/bebidas con precios USD).
6. Promoción de prueba (Promo 3x2 en Coca-Cola).

Ejecución mediante Bench:
    bench --site erp.localhost execute posawesome.setup.set_data
"""

from __future__ import annotations

from typing import Any
import frappe
from frappe.utils import nowdate
from frappe.utils.password import update_password


def set_data(
    company_name: str = "Galanet Solution C.A.",
    profile_name: str = "GIO",
    cashier_email: str = "cajero.pos@galanet.com",
) -> None:
    """Punto de entrada principal para el aprovisionamiento del entorno POS."""
    print(f"\n=== INICIANDO SETUP DE POS AWESOME PARA {company_name} ===")

    try:
        customer_id: str = create_default_customer(customer_name="Clientes Varios")
        setup_payment_methods(company_name=company_name)
        configure_pos_profile(
            profile_name=profile_name,
            customer_id=customer_id,
            company_name=company_name,
        )
        setup_cashier_user(cashier_email=cashier_email, profile_name=profile_name)
        setup_retail_demo_items(profile_name=profile_name)
        setup_demo_pos_offer(company_name=company_name)

        frappe.db.commit()
        print("\n=== SETUP DE POS AWESOME COMPLETADO EXITOSAMENTE ===")
    except Exception as error:
        frappe.db.rollback()
        print(f"\n[ERROR] Falló la configuración de POS Awesome: {error}")
        frappe.log_error(frappe.get_traceback(), "Error en posawesome.setup.set_data")
        raise error


def create_default_customer(customer_name: str = "Clientes Varios") -> str:
    """Crea o asegura el cliente genérico para ventas al mostrador."""
    customer_id: str | None = frappe.db.get_value(
        "Customer", {"customer_name": customer_name}, "name"
    )

    if not customer_id:
        cg: str | None = frappe.db.get_value("Customer Group", filters={}, fieldname="name")
        terr: str | None = frappe.db.get_value("Territory", filters={}, fieldname="name")
        customer = frappe.new_doc("Customer")
        customer.customer_name = customer_name
        customer.customer_group = cg or "Commercial"
        customer.territory = terr or "Venezuela"
        customer.customer_type = "Individual"
        customer.tax_id = "V-00000000-0"
        customer.email_id = "clientes.varios@galanet.com"
        customer.mobile_no = "+584120000000"
        customer.insert(ignore_permissions=True)
        customer_id = customer.name
        print(f"✓ Cliente creado: {customer_name} ({customer_id})")
    else:
        print(f"✓ Cliente ya existe: {customer_name} ({customer_id})")

    return customer_id


def setup_payment_methods(company_name: str = "Galanet Solution C.A.") -> None:
    """Asegura los modos de pago requeridos y sus cuentas contables asociadas."""
    mode_account_map: dict[str, str] = {
        "Efectivo": "1101002 - Caja Tesorería Bolívares - Galanet",
        "Efectivo USD": "1101001 - Caja Tesoreria dolares - Galanet",
        "Pagomóvil": "1102001 - Banco de Venezuela Bs. Cte. 1347 DC-01 - Galanet",
        "Tarjetas de débito": "1102037 - Bancaribe Bs. 1120 DC-01 - Galanet",
        "Tarjetas de credito": "1102037 - Bancaribe Bs. 1120 DC-01 - Galanet",
        "ZELLE": "1103002 - Banesco Panama USD Cte 4146 DC-01 - Galanet",
        "Biopago": "1102037 - Bancaribe Bs. 1120 DC-01 - Galanet",
        "Cashea": "1101002 - Caja Tesorería Bolívares - Galanet",
    }

    for mode_name, acc in mode_account_map.items():
        if not frappe.db.exists("Mode of Payment", mode_name):
            m: Any = frappe.new_doc("Mode of Payment")
            m.mode_of_payment = mode_name
            m.type = "Cash" if "Efectivo" in mode_name else "Bank"
            m.enabled = 1
            m.append("accounts", {"company": company_name, "default_account": acc})
            m.insert(ignore_permissions=True)
            print(f"✓ Modo de pago creado: {mode_name}")
        else:
            m = frappe.get_doc("Mode of Payment", mode_name)
            has_company: bool = any(a.company == company_name for a in m.accounts)
            if not has_company:
                m.append("accounts", {"company": company_name, "default_account": acc})
                m.save(ignore_permissions=True)
                print(f"✓ Cuenta asignada a modo de pago: {mode_name} -> {acc}")


def configure_pos_profile(
    profile_name: str = "GIO",
    customer_id: str = "CUST-2026-00081",
    company_name: str = "Galanet Solution C.A.",
) -> None:
    """Configura los permisos y modos de pago dentro del perfil de punto de venta."""
    if not frappe.db.exists("POS Profile", profile_name):
        print(f"✗ Perfil POS '{profile_name}' no existe.")
        return

    profile: Any = frappe.get_doc("POS Profile", profile_name)
    profile.customer = customer_id
    profile.posa_allow_multi_currency = 1
    profile.posa_allow_return = 1
    profile.posa_allow_user_to_edit_additional_discount = 1
    profile.posa_allow_user_to_edit_item_discount = 1
    profile.posa_allow_user_to_edit_rate = 1
    profile.posa_allow_partial_payment = 1
    profile.posa_allow_delete = 1
    profile.posa_hide_closing_shift = 0

    modes_to_add: list[str] = [
        "Efectivo",
        "Efectivo USD",
        "Pagomóvil",
        "Tarjetas de débito",
        "Tarjetas de credito",
        "ZELLE",
        "Biopago",
        "Cashea",
    ]

    existing_modes: set[str] = {p.mode_of_payment for p in profile.payments}
    for mode_name in modes_to_add:
        if mode_name not in existing_modes:
            profile.append(
                "payments",
                {
                    "mode_of_payment": mode_name,
                    "default": 1 if mode_name == "Efectivo" else 0,
                    "allow_in_returns": 1,
                },
            )
            print(f"✓ Agregado al perfil POS {profile_name}: {mode_name}")

    for p in profile.payments:
        p.default = 1 if p.mode_of_payment == "Efectivo" else 0

    profile.save(ignore_permissions=True)
    print(f"✓ Perfil POS {profile_name} configurado exitosamente.")


def setup_cashier_user(
    cashier_email: str = "cajero.pos@galanet.com",
    profile_name: str = "GIO",
) -> None:
    """Crea el usuario cajero y asigna el PIN 1234 para terminales compartidos."""
    if not frappe.db.exists("User", cashier_email):
        user: Any = frappe.new_doc("User")
        user.email = cashier_email
        user.first_name = "Cajero"
        user.last_name = "Mostrador"
        user.send_welcome_email = 0
        available_roles: list[str] = [
            r for r in ["Sales User", "Accounts User", "POS Manager"] if frappe.db.exists("Role", r)
        ]
        for r in available_roles:
            user.append("roles", {"role": r})
        user.insert(ignore_permissions=True)
        update_password(cashier_email, "Cajero123*")
        print(f"✓ Usuario cajero creado: {cashier_email} (Contraseña: Cajero123*)")
    else:
        print(f"✓ Usuario cajero ya existe: {cashier_email}")

    # Configuración de PIN de desbloqueo rápido (posa_pos_pin = 1234)
    from frappe.utils.password import set_encrypted_password
    for u in ["Administrator", cashier_email]:
        if frappe.db.exists("User", u):
            frappe.db.delete("__Auth", {"doctype": "User", "name": u, "fieldname": "posa_pos_pin"})
            set_encrypted_password("User", u, "1234", fieldname="posa_pos_pin")
            print(f"✓ PIN de cajero '1234' configurado para: {u}")

    # Vincular en tabla de usuarios del perfil POS
    if frappe.db.exists("POS Profile", profile_name):
        profile: Any = frappe.get_doc("POS Profile", profile_name)
        if profile.meta.has_field("applicable_for_users"):
            existing_users: set[str] = {u.user for u in profile.applicable_for_users}
            if cashier_email not in existing_users:
                profile.append("applicable_for_users", {"user": cashier_email, "default": 1})
                profile.save(ignore_permissions=True)
                print(f"✓ Cajero {cashier_email} vinculado al Perfil POS {profile_name}.")


def setup_retail_demo_items(profile_name: str = "GIO") -> None:
    """Carga artículos de prueba de retail y fija sus precios en USD."""
    print("\n--- Artículos de Prueba para Retail ---")
    retail_items: list[dict[str, Any]] = [
        {"item_code": "DEMO-COCA-2L", "item_name": "Coca-Cola 2 Litros", "rate": 2.50},
        {"item_code": "DEMO-HARINA-PAN", "item_name": "Harina PAN 1kg", "rate": 1.20},
        {"item_code": "DEMO-CAFE-500G", "item_name": "Café Molido 500g", "rate": 4.00},
        {"item_code": "DEMO-QUESO-1KG", "item_name": "Queso Llanero 1kg", "rate": 6.50},
        {"item_code": "DEMO-CHOCO-SAVOY", "item_name": "Chocolate Savoy con Leche", "rate": 1.50},
        {"item_code": "DEMO-COMBO-BURGER", "item_name": "Combo Hamburguesa + Papas", "rate": 8.00},
        {"item_code": "DEMO-PRINGLES", "item_name": "Papas Pringles 124g", "rate": 3.50},
        {"item_code": "DEMO-AGUA-15L", "item_name": "Agua Mineral Minalba 1.5L", "rate": 1.00},
    ]

    price_list: str = "Venta estándar"
    if frappe.db.exists("POS Profile", profile_name):
        price_list = (
            frappe.db.get_value("POS Profile", profile_name, "selling_price_list")
            or "Venta estándar"
        )

    for it_data in retail_items:
        code: str = it_data["item_code"]
        name: str = it_data["item_name"]
        rate: float = float(it_data["rate"])

        if not frappe.db.exists("Item", code):
            item_doc: Any = frappe.new_doc("Item")
            item_doc.item_code = code
            item_doc.item_name = name
            item_doc.item_group = (
                "Productos" if frappe.db.exists("Item Group", "Productos") else "All Item Groups"
            )
            item_doc.stock_uom = (
                "Unidad(es)" if frappe.db.exists("UOM", "Unidad(es)") else "Nos"
            )
            item_doc.is_stock_item = 0
            item_doc.is_sales_item = 1
            item_doc.insert(ignore_permissions=True)
            print(f"✓ Artículo creado: {name} ({code})")
        else:
            print(f"✓ Artículo existente: {name} ({code})")

        # Configuración del Precio de Lista en USD
        if not frappe.db.exists("Item Price", {"item_code": code, "price_list": price_list}):
            price_doc: Any = frappe.new_doc("Item Price")
            price_doc.item_code = code
            price_doc.price_list = price_list
            price_doc.price_list_rate = rate
            price_doc.currency = "USD"
            price_doc.insert(ignore_permissions=True)
            print(f"  └ Precio fijado: ${rate:.2f} USD")
        else:
            price_id: str | None = frappe.db.get_value(
                "Item Price", {"item_code": code, "price_list": price_list}, "name"
            )
            if price_id:
                frappe.db.set_value(
                    "Item Price",
                    price_id,
                    {"price_list_rate": rate, "currency": "USD"},
                )
                print(f"  └ Precio actualizado: ${rate:.2f} USD")


def setup_demo_pos_offer(company_name: str = "Galanet Solution C.A.") -> None:
    """Configura la promoción 3x2 en Coca-Cola 2L."""
    print("\n--- Promoción Demo (3x2) ---")
    promo_name: str = "Promo 3x2 Coca Cola"
    today: str = nowdate()

    if not frappe.db.exists("POS Offer", promo_name):
        offer_doc: Any = frappe.new_doc("POS Offer")
        offer_doc.title = promo_name
        offer_doc.description = "Lleva 2 Coca-Cola 2L y la 3ra es gratis (Promo 3x2)"
        offer_doc.disable = 0
        offer_doc.company = company_name
        offer_doc.apply_on = "Item Code"
        offer_doc.item = "DEMO-COCA-2L"
        offer_doc.offer = "Give Product"
        offer_doc.apply_type = "Item Code"
        offer_doc.apply_item_code = "DEMO-COCA-2L"
        offer_doc.min_qty = 2
        offer_doc.max_qty = 0
        offer_doc.given_qty = 1
        offer_doc.auto = 1
        offer_doc.discount_type = "Discount Percentage"
        offer_doc.discount_percentage = 100
        offer_doc.valid_from = today
        offer_doc.valid_upto = "2030-12-31"
        offer_doc.coupon_based = 0
        offer_doc.insert(ignore_permissions=True)
        print(f"✓ Oferta POS creada exitosamente: {promo_name} (3x2 en DEMO-COCA-2L)")
    else:
        offer_doc = frappe.get_doc("POS Offer", promo_name)
        offer_doc.company = company_name
        offer_doc.apply_on = "Item Code"
        offer_doc.item = "DEMO-COCA-2L"
        offer_doc.offer = "Give Product"
        offer_doc.apply_type = "Item Code"
        offer_doc.apply_item_code = "DEMO-COCA-2L"
        offer_doc.min_qty = 2
        offer_doc.max_qty = 0
        offer_doc.given_qty = 1
        offer_doc.auto = 1
        offer_doc.discount_type = "Discount Percentage"
        offer_doc.discount_percentage = 100
        offer_doc.valid_upto = "2030-12-31"
        offer_doc.disable = 0
        offer_doc.save(ignore_permissions=True)
        print(f"✓ Oferta POS actualizada exitosamente: {promo_name} (3x2 en DEMO-COCA-2L)")


if __name__ == "__main__":
    import os
    import sys

    # Evitar que el directorio local de posawesome sobreescriba el paquete raíz
    bench_dir: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    apps_dir: str = os.path.join(bench_dir, "apps")
    posawesome_pkg_dir: str = os.path.join(apps_dir, "posawesome")
    sites_dir: str = os.path.join(bench_dir, "sites")

    script_dir: str = os.path.dirname(os.path.abspath(__file__))
    if sys.path and sys.path[0] == script_dir:
        sys.path.pop(0)

    for p in [posawesome_pkg_dir, apps_dir, bench_dir]:
        if p not in sys.path:
            sys.path.insert(0, p)

    if os.path.exists(sites_dir):
        os.chdir(sites_dir)

    frappe.init(site="erp.localhost")
    frappe.connect()
    set_data()
