import { Navbar } from "@/components/globals/Nav";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      <main>{children}</main>;
    </>
  );
}
