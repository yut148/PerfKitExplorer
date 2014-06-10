/**
 * @fileoverview container is an angular directive used to show a container that
 * is bound to a ContainerWidgetModel. It can contain elements and can organize
 * them visually in three different way: row, column, or wrap.
 *
 * Usage:
 *   <container class="dashkit-container-content"
 *              container-config="containerConfigConfig"/>
 *
 * Attributes:
 *     {p3rf.dashkit.explorer.components.container.
 *         ContainerWidgetConfig} container-config
 *
 * @author joemu@google.com (Joe Allan Muharsky)
 */

goog.provide('p3rf.dashkit.explorer.components.container.ContainerDirective');

/**
 * See module docstring for more information about purpose and usage.
 *
 * @return {Object} Directive definition object.
 */
p3rf.dashkit.explorer.components.container.
ContainerDirective = function() {
  return {
    restrict: 'E',
    replace: true,
    transclude: true,
    scope: {
      containerConfig: '='
    },
    // TODO: Use templateUrl instead of hardcoded template text.
    template: '<div ng-class="flexClass" ng-style="layoutStyle" ' +
              'ng-transclude></div>',
    link: function(scope, element, attributes) {
      var updateClasses = function() {
        // Change the visual organization of child elements
        /**
         * Hold state specific classes.
         * @type {Object}
         */
        scope.flexClass = {
          'dashkit-container-selected' : scope.containerConfig.state().selected
        };

        var className = 'flex-' + scope.containerConfig.model.container.flow;
        scope.flexClass[className] = true;
      };
      updateClasses();

      // When the layout size change
      scope.$watch('containerConfig.model.container.flow', function() {
        updateClasses();
      });

      // When the layout size change
      scope.$watch('containerConfig.state().selected', function() {
        updateClasses();
      });
    }
  };
};
