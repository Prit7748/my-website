import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    // 1. Database Connect karein
    await connectDB();

    // 2. User dhundhe (Password ke sath)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 400 });
    }

    // 3. Password match karein
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid password" }, { status: 400 });
    }

    // 4. Success message bhejein
    return NextResponse.json({ message: "Login successful", user }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Error: " + error.message }, { status: 500 });
  }
}