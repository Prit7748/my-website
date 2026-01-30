import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    
    // 1. Database Connect karein
    await connectDB();

    // 2. Check karein user pehle se hai ya nahi
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    // 3. Password ko encrypt karein
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Naya user create karein
    await User.create({ name, email, password: hashedPassword });

    return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 });
  }
}