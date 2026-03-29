from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import jwt
import datetime
import os
import json as json_lib
from functools import wraps

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)

# ── Config ──────────────────────────────────────────────
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///twodots.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "twodots-secret-key-change-in-production")

# Fix postgres:// → postgresql://
db_url = app.config["SQLALCHEMY_DATABASE_URI"]
if db_url.startswith("postgres://"):
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url.replace("postgres://", "postgresql://", 1)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)


# ── Models ───────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    phone      = db.Column(db.String(15), nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    dob        = db.Column(db.String(20))
    gender     = db.Column(db.String(20))
    address    = db.Column(db.String(300))
    city       = db.Column(db.String(100))
    pincode    = db.Column(db.String(10))
    photo      = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    orders     = db.relationship("Order", backref="user", lazy=True)
    addresses  = db.relationship("Address", backref="user", lazy=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "email": self.email,
            "phone": self.phone, "dob": self.dob, "gender": self.gender,
            "address": self.address, "city": self.city,
            "pincode": self.pincode, "photo": self.photo,
        }


class Order(db.Model):
    __tablename__ = "orders"
    id              = db.Column(db.Integer, primary_key=True)
    order_id        = db.Column(db.String(50), unique=True, nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    items           = db.Column(db.Text, nullable=False)
    total           = db.Column(db.Float, nullable=False)
    status          = db.Column(db.String(50), default="confirmed")
    payment_method  = db.Column(db.String(50))
    address_name    = db.Column(db.String(100))
    address_phone   = db.Column(db.String(15))
    address_flat    = db.Column(db.String(200))
    address_area    = db.Column(db.String(200))
    address_city    = db.Column(db.String(100))
    address_state   = db.Column(db.String(100))
    address_pincode = db.Column(db.String(10))
    created_at      = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.order_id,
            "date": self.created_at.strftime("%d %b %Y"),
            "status": self.status,
            "total": self.total,
            "paymentMethod": self.payment_method,
            "items": json_lib.loads(self.items),
            "address": {
                "name": self.address_name, "phone": self.address_phone,
                "flat": self.address_flat, "area": self.address_area,
                "city": self.address_city, "state": self.address_state,
                "pincode": self.address_pincode,
            },
        }


class Address(db.Model):
    __tablename__ = "addresses"
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    phone      = db.Column(db.String(15), nullable=False)
    house      = db.Column(db.String(300), nullable=False)
    city       = db.Column(db.String(100), nullable=False)
    state      = db.Column(db.String(100))
    pincode    = db.Column(db.String(10), nullable=False)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "phone": self.phone,
            "house": self.house, "city": self.city, "state": self.state,
            "pincode": self.pincode, "default": self.is_default,
        }


class Feedback(db.Model):
    __tablename__ = "feedback"
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"))
    user_name  = db.Column(db.String(100))
    user_email = db.Column(db.String(120))
    text       = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class Wishlist(db.Model):
    __tablename__ = "wishlist"
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    name       = db.Column(db.String(200), nullable=False)
    price      = db.Column(db.Integer, nullable=False)
    image      = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.product_id, "name": self.name,
            "price": self.price, "image": self.image,
        }


# ── JWT Helper ───────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            current_user = User.query.get(data["user_id"])
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def make_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


# ── Auth Routes ──────────────────────────────────────────
@app.route("/signup", methods=["POST"])
def signup():
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data provided"}), 400
    name     = d.get("name", "").strip()
    email    = d.get("email", "").strip().lower()
    phone    = d.get("phone", "").strip()
    password = d.get("password", "")
    dob      = d.get("dob", "")
    gender   = d.get("gender", "")
    if not all([name, email, phone, password]):
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be 6+ characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409
    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(name=name, email=email, phone=phone, password=hashed, dob=dob, gender=gender)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Account created successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data provided"}), 400
    email    = d.get("email", "").strip().lower()
    password = d.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401
    token = make_token(user.id)
    return jsonify({"token": token, "user": user.to_dict()}), 200


# ── Profile Routes ───────────────────────────────────────
@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    return jsonify({"user": current_user.to_dict()}), 200


@app.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data"}), 400
    current_user.name    = d.get("name", current_user.name).strip()
    current_user.phone   = d.get("phone", current_user.phone).strip()
    current_user.dob     = d.get("dob", current_user.dob)
    current_user.gender  = d.get("gender", current_user.gender)
    current_user.address = d.get("address", current_user.address)
    current_user.city    = d.get("city", current_user.city)
    current_user.pincode = d.get("pincode", current_user.pincode)
    db.session.commit()
    return jsonify({"message": "Profile updated", "user": current_user.to_dict()}), 200


# ── Products Route ───────────────────────────────────────
@app.route("/products", methods=["GET"])
def get_products():
    products_path = os.path.join(os.path.dirname(__file__), "products.json")
    try:
        with open(products_path, "r") as f:
            products = json_lib.load(f)
        category = request.args.get("category")
        if category:
            products = [p for p in products if p.get("category") == category]
        return jsonify(products), 200
    except FileNotFoundError:
        return jsonify({"error": "products.json not found"}), 404


# ── Orders Routes ────────────────────────────────────────
@app.route("/orders", methods=["POST"])
@token_required
def place_order(current_user):
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data"}), 400
    cart    = d.get("items", [])
    total   = d.get("total", 0)
    addr    = d.get("address", {})
    payment = d.get("paymentMethod", "cod")
    if not cart:
        return jsonify({"error": "Cart is empty"}), 400
    order_id = "ORD-" + str(int(datetime.datetime.utcnow().timestamp() * 1000))
    order = Order(
        order_id=order_id, user_id=current_user.id,
        items=json_lib.dumps(cart), total=total, payment_method=payment,
        address_name=addr.get("name", ""), address_phone=addr.get("phone", ""),
        address_flat=addr.get("flat", ""), address_area=addr.get("area", ""),
        address_city=addr.get("city", ""), address_state=addr.get("state", ""),
        address_pincode=addr.get("pincode", ""),
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({"message": "Order placed!", "orderId": order_id}), 201


@app.route("/orders", methods=["GET"])
@token_required
def get_orders(current_user):
    orders = Order.query.filter_by(user_id=current_user.id)\
                        .order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200


# ── Addresses Routes ─────────────────────────────────────
@app.route("/addresses", methods=["GET"])
@token_required
def get_addresses(current_user):
    addresses = Address.query.filter_by(user_id=current_user.id)\
                             .order_by(Address.is_default.desc(), Address.created_at.desc()).all()
    return jsonify([a.to_dict() for a in addresses]), 200


@app.route("/addresses", methods=["POST"])
@token_required
def add_address(current_user):
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data"}), 400
    name    = d.get("name", "").strip()
    phone   = d.get("phone", "").strip()
    house   = d.get("house", "").strip()
    city    = d.get("city", "").strip()
    state   = d.get("state", "").strip()
    pincode = d.get("pincode", "").strip()
    is_default = d.get("default", False)
    if not all([name, phone, house, city, pincode]):
        return jsonify({"error": "All fields are required"}), 400
    # If new address is default, remove default from others
    if is_default:
        Address.query.filter_by(user_id=current_user.id, is_default=True)\
                     .update({"is_default": False})
    # If it's the first address, make it default automatically
    count = Address.query.filter_by(user_id=current_user.id).count()
    if count == 0:
        is_default = True
    addr = Address(
        user_id=current_user.id, name=name, phone=phone,
        house=house, city=city, state=state, pincode=pincode, is_default=is_default
    )
    db.session.add(addr)
    db.session.commit()
    return jsonify({"message": "Address saved!", "address": addr.to_dict()}), 201


@app.route("/addresses/<int:addr_id>", methods=["PUT"])
@token_required
def update_address(current_user, addr_id):
    addr = Address.query.filter_by(id=addr_id, user_id=current_user.id).first()
    if not addr:
        return jsonify({"error": "Address not found"}), 404
    d = request.get_json()
    addr.name       = d.get("name", addr.name).strip()
    addr.phone      = d.get("phone", addr.phone).strip()
    addr.house      = d.get("house", addr.house).strip()
    addr.city       = d.get("city", addr.city).strip()
    addr.state      = d.get("state", addr.state)
    addr.pincode    = d.get("pincode", addr.pincode).strip()
    addr.is_default = d.get("default", addr.is_default)
    if addr.is_default:
        Address.query.filter(Address.user_id==current_user.id, Address.id!=addr_id)\
                     .update({"is_default": False})
    db.session.commit()
    return jsonify({"message": "Address updated!", "address": addr.to_dict()}), 200


@app.route("/addresses/<int:addr_id>", methods=["DELETE"])
@token_required
def delete_address(current_user, addr_id):
    addr = Address.query.filter_by(id=addr_id, user_id=current_user.id).first()
    if not addr:
        return jsonify({"error": "Address not found"}), 404
    db.session.delete(addr)
    db.session.commit()
    return jsonify({"message": "Address deleted!"}), 200


# ── Feedback Route ───────────────────────────────────────
@app.route("/feedback", methods=["POST"])
@token_required
def submit_feedback(current_user):
    d = request.get_json()
    text = d.get("text", "").strip()
    if not text:
        return jsonify({"error": "Feedback text required"}), 400
    fb = Feedback(
        user_id=current_user.id, user_name=current_user.name,
        user_email=current_user.email, text=text,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"message": "Thank you for your feedback!"}), 201


# ── Wishlist Routes ──────────────────────────────────────
@app.route("/wishlist", methods=["GET"])
@token_required
def get_wishlist(current_user):
    items = Wishlist.query.filter_by(user_id=current_user.id)                          .order_by(Wishlist.created_at.desc()).all()
    return jsonify([i.to_dict() for i in items]), 200


@app.route("/wishlist", methods=["POST"])
@token_required
def add_to_wishlist(current_user):
    d = request.get_json()
    if not d:
        return jsonify({"error": "No data"}), 400
    product_id = d.get("id") or d.get("product_id")  # accept both keys
    name       = d.get("name", "")
    price      = d.get("price", 0)
    image      = d.get("image", "")
    if product_id is None:
        return jsonify({"error": "Product id required"}), 400
    try:
        product_id = int(product_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid product id"}), 400
    # Don't add duplicate
    exists = Wishlist.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    if exists:
        return jsonify({"message": "Already in wishlist"}), 200
    item = Wishlist(user_id=current_user.id, product_id=product_id,
                    name=name, price=price, image=image)
    db.session.add(item)
    db.session.commit()
    return jsonify({"message": "Added to wishlist!"}), 201


@app.route("/wishlist/<int:product_id>", methods=["DELETE"])
@token_required
def remove_from_wishlist(current_user, product_id):
    item = Wishlist.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    if not item:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Removed from wishlist!"}), 200


# ── Health Check ─────────────────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "Two Dots API is running 🟢"}), 200


# ── Init DB & Run ────────────────────────────────────────
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)