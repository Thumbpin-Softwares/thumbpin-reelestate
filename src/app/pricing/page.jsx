import { Navbar } from "@/modules/home/components/navbar";
import Payment from "@/modules/pricing/payment";
import Footer from "@/modules/common/layout/footer";
import Carousal from "@/modules/common/components/carousal";
import Faq from "@/modules/pricing/faq";

export default function Page(){
    return(
        <main>
            <Navbar />

            <div className="pt-24">
                <Payment />
            </div>

            <div>
                <Carousal />
            </div>

            <div>
                <Faq />
            </div>

            <Footer />
        </main>
    );
}