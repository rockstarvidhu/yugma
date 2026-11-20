import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { signIn } from "./actions";
import { SignInForm } from "./SignInForm";

vi.mock("./actions", () => ({ signIn: vi.fn() }));
afterEach(cleanup);

it("keeps the email and clears the password after a rejected sign-in", async () => {
  vi.mocked(signIn).mockResolvedValue(
    "We couldn’t sign you in. Check your details and try again.",
  );
  render(<SignInForm returnTo="/studio" />);

  const email = screen.getByLabelText("Email address");
  const password = screen.getByLabelText("Password");
  fireEvent.change(email, { target: { value: "sample@example.test" } });
  fireEvent.change(password, { target: { value: "wrong-test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Check your details and try again.",
  );
  expect(email).toHaveValue("sample@example.test");
  expect(password).toHaveValue("");
});
