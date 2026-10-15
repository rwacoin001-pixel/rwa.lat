package lat.rwa.trial;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AppPackTest {
    @Test public void nextCatchAllFolderIsNotTraversal() {
        assertFalse(AppPack.traversal("/_next/static/chunks/app/[[...rwa]]/page-9960ea3334cb744c.js"));
        assertFalse(AppPack.traversal("/media/home/hero-cool.webp"));
    }

    @Test public void dotSegmentsAreTraversal() {
        assertTrue(AppPack.traversal("/_next/static/../../secret"));
        assertTrue(AppPack.traversal("/icons/./a.png"));
        assertTrue(AppPack.traversal("/icons/.."));
    }
}
