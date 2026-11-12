import { HomeCapabilities } from '@/features/home/ui/HomeCapabilities';
import { HomeFaq } from '@/features/home/ui/HomeFaq';
import { HomeHero } from '@/features/home/ui/HomeHero';
import { HomeHowItWorks } from '@/features/home/ui/HomeHowItWorks';
import { HomeScrollFade } from '@/features/home/ui/HomeScrollFade';
import { HomeStudioSection } from '@/features/home/ui/HomeStudioSection';

export function HomePage() {
    return (
        <>
            <div className="flex flex-col pb-[clamp(3rem,8dvh,6rem)] lg:min-h-[calc(100dvh-var(--public-header-space,4.75rem))]">
                <HomeHero />
                <HomeCapabilities />
            </div>
            <HomeScrollFade />
            <HomeHowItWorks />
            <div className="w-full">
                <HomeStudioSection />
            </div>
            <HomeFaq />
        </>
    );
}
