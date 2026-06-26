import { Navbar } from "@/modules/home/components/navbar";
import Payment from "@/modules/pricing/payment";
import Footer from "@/modules/common/layout/footer";

export default function Page(){
    return(
        <main>
            <Navbar />

            <div className="pt-24">
                <Payment />
            </div>

            <Footer />
        </main>
    );
}